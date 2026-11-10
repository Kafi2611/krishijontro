/**
 * Stats service — the numbers behind the dashboard charts.
 *
 * Each function reads the rows it needs and turns them into chart points with the pure helpers
 * of stats-rules.ts (months, sums by name). The pages turn the keys into words in the reader's
 * language (a month name, a role name...).
 *   - getProviderStats(): the provider's earnings per month and jobs per machine
 *   - getAdminStats():    bookings and platform fees per month, and accounts per role
 *   - getGovtReports():   bookings by district, demand vs supply, prices, subsidy, the demand map
 */
import type { BookingStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { getProviderShare } from "@/lib/services/booking-rules";
import { startOfDhakaDay } from "@/lib/services/calendar";
import { PAID_BOOKING_STATUSES } from "@/lib/services/payment-rules";
import { listPricedMachineTypes } from "@/lib/services/pricing-rule";
import { LISTED_MACHINE } from "@/lib/services/search";
import { buildDemandPlaces, lastMonths, sumByKey, sumByMonth, type ChartPoint } from "@/lib/services/stats-rules";

/** How many months the "per month" charts show (this month and the 5 before it). */
export const CHART_MONTHS = 6;

/** Bookings that never went ahead: they do not count as work or demand. */
export const NOT_WORKED_STATUSES: BookingStatus[] = ["REJECTED", "CANCELLED"];

/** The first moment of the oldest month on the charts (Bangladesh time). */
function chartStart(months: string[]): Date {
  return startOfDhakaDay(`${months[0]}-01`);
}

// ─────────────────────────── The provider ───────────────────────────

/**
 * The provider's charts:
 * - earnedByMonth: their share (work + delivery − fee) of the jobs PAID, by the month the work finished
 * - jobsByMachine: how many jobs each of their machines has had (rejected and cancelled not counted)
 */
export async function getProviderStats(providerId: string) {
  const months = lastMonths(CHART_MONTHS);
  const [paid, jobs, machines] = await Promise.all([
    db.booking.findMany({
      where: { machine: { providerId }, status: { in: PAID_BOOKING_STATUSES }, completedAt: { gte: chartStart(months) } },
      select: { completedAt: true, workCharge: true, deliveryCharge: true, platformFee: true },
    }),
    db.booking.groupBy({
      by: ["machineId"],
      where: { machine: { providerId }, status: { notIn: NOT_WORKED_STATUSES } },
      _count: { _all: true },
    }),
    db.machine.findMany({ where: { providerId }, select: { id: true, brand: true, model: true } }),
  ]);

  const earnedByMonth = sumByMonth(
    paid.map((booking) => ({ date: booking.completedAt ?? new Date(0), amount: getProviderShare(booking) })),
    months,
  );
  const machineNames = new Map(machines.map((machine) => [machine.id, `${machine.brand} ${machine.model}`]));
  const jobsByMachine = sumByKey(
    jobs.map((row) => ({ key: machineNames.get(row.machineId) ?? "?", amount: row._count._all })),
  );
  return { earnedByMonth, jobsByMachine };
}

// ─────────────────────────── The admin ───────────────────────────

/**
 * The admin's charts:
 * - bookingsByMonth: new bookings by the month they were made (every status)
 * - feesByMonth: KrishiJontro's platform fee of the PAID jobs, by the month the work finished
 * - usersByRole: how many accounts each role has (the key is the role, e.g. "FARMER")
 */
export async function getAdminStats() {
  const months = lastMonths(CHART_MONTHS);
  const since = chartStart(months);
  const [bookings, paid, roles] = await Promise.all([
    db.booking.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.booking.findMany({
      where: { status: { in: PAID_BOOKING_STATUSES }, completedAt: { gte: since } },
      select: { completedAt: true, platformFee: true },
    }),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  const bookingsByMonth = sumByMonth(
    bookings.map((booking) => ({ date: booking.createdAt, amount: 1 })),
    months,
  );
  const feesByMonth = sumByMonth(
    paid.map((booking) => ({ date: booking.completedAt ?? new Date(0), amount: booking.platformFee })),
    months,
  );
  const usersByRole: ChartPoint[] = sumByKey(
    roles.map((row) => ({ key: row.role, amount: row._count._all })),
  );
  return { bookingsByMonth, feesByMonth, usersByRole };
}

// ─────────────────────────── The government's reports ───────────────────────────

/** "Demand" and "average price" look at the bookings made in this many days. */
export const REPORT_DAYS = 90;

/** A place or a machine type, with its name in both languages. */
type Named = { name: string; nameBn: string };

/**
 * Everything the government's Reports page shows:
 * - totalBookings: bookings that went ahead (not rejected or cancelled), all time
 * - byDistrict: those bookings by the district of the field, biggest first
 * - demandVsSupply: per machine type, bookings in the last 90 days vs machines ready to rent
 * - prices: per machine type, today's allowed range and the average booked rate (last 90 days)
 * - subsidyByMonth: subsidy money given on paid jobs, per month
 * - demandMap: per upazila (with its centre point), bookings + farmers still waiting — the heatmap
 */
export async function getGovtReports() {
  const months = lastMonths(CHART_MONTHS);
  const since = new Date(Date.now() - REPORT_DAYS * 24 * 60 * 60 * 1000);
  const worked = { status: { notIn: NOT_WORKED_STATUSES } };

  const [bookingsPerUpazila, recent, machineTypes, readyMachines, subsidyRows, waiting] = await Promise.all([
    // How many bookings went ahead in each upazila (of the field). The database counts them,
    // so this stays fast however many bookings there are.
    db.booking.groupBy({ by: ["locationId"], where: worked, _count: { _all: true } }),
    // The last 90 days: which machine type, and the rate booked.
    db.booking.findMany({
      where: { ...worked, createdAt: { gte: since } },
      select: { rateSnapshot: true, machine: { select: { machineTypeId: true } } },
    }),
    listPricedMachineTypes(),
    db.machine.groupBy({ by: ["machineTypeId"], where: LISTED_MACHINE, _count: { _all: true } }),
    db.booking.findMany({
      where: { status: { in: PAID_BOOKING_STATUSES }, subsidyAmount: { gt: 0 }, completedAt: { gte: chartStart(months) } },
      select: { completedAt: true, subsidyAmount: true },
    }),
    // Farmers still waiting for a machine: demand that found no machine.
    db.waitlistEntry.findMany({
      where: { status: "WAITING", locationId: { not: null } },
      select: { locationId: true, location: { select: { name: true, nameBn: true, lat: true, lng: true } } },
    }),
  ]);

  // The upazilas that have bookings, with their centre and their district (one row each).
  const upazilas = await db.location.findMany({
    where: { id: { in: bookingsPerUpazila.map((row) => row.locationId) } },
    select: { id: true, name: true, nameBn: true, lat: true, lng: true, parent: { select: { id: true, name: true, nameBn: true } } },
  });
  const upazilaById = new Map(upazilas.map((upazila) => [upazila.id, upazila]));
  let totalBookings = 0;
  for (const row of bookingsPerUpazila) {
    totalBookings += row._count._all;
  }

  // ── Bookings by district ──
  const districtNames = new Map<string, Named>();
  const districtRows: { key: string; amount: number }[] = [];
  for (const row of bookingsPerUpazila) {
    const district = upazilaById.get(row.locationId)?.parent;
    if (district) {
      districtNames.set(district.id, district);
      districtRows.push({ key: district.id, amount: row._count._all });
    }
  }
  const byDistrict = sumByKey(districtRows).map((point) => ({ ...districtNames.get(point.key)!, value: point.value }));

  // ── Demand vs supply, and prices, per machine type ──
  const machinesByType = new Map(readyMachines.map((row) => [row.machineTypeId, row._count._all]));
  const demandVsSupply = machineTypes.map((type) => ({
    name: type.name,
    nameBn: type.nameBn,
    bookings: recent.filter((booking) => booking.machine.machineTypeId === type.id).length,
    machines: machinesByType.get(type.id) ?? 0,
  }));
  const prices = machineTypes.map((type) => {
    const rates = recent.filter((booking) => booking.machine.machineTypeId === type.id).map((booking) => booking.rateSnapshot);
    let sum = 0;
    for (const rate of rates) {
      sum += rate;
    }
    return {
      name: type.name,
      nameBn: type.nameBn,
      billingUnit: type.billingUnit,
      minRate: type.minRate,
      maxRate: type.maxRate,
      averageRate: rates.length > 0 ? Math.round(sum / rates.length) : null, // null = no booking lately
      bookingCount: rates.length,
    };
  });

  // ── Subsidy given per month ──
  const subsidyByMonth = sumByMonth(
    subsidyRows.map((row) => ({ date: row.completedAt ?? new Date(0), amount: row.subsidyAmount })),
    months,
  );

  // ── The demand heatmap: bookings + farmers still waiting, per upazila ──
  const demandMap = buildDemandPlaces([
    ...bookingsPerUpazila
      .filter((row) => upazilaById.has(row.locationId))
      .map((row) => ({ kind: "booking" as const, placeId: row.locationId, place: upazilaById.get(row.locationId)!, count: row._count._all })),
    ...waiting
      .filter((entry) => entry.locationId !== null && entry.location !== null)
      .map((entry) => ({ kind: "waiting" as const, placeId: entry.locationId!, place: entry.location! })),
  ]);

  return { totalBookings, byDistrict, demandVsSupply, prices, subsidyByMonth, demandMap };
}
