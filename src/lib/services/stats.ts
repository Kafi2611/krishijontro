/**
 * Stats service — the numbers behind the dashboard charts.
 *
 * Each function reads the rows it needs and turns them into chart points with the pure helpers
 * of stats-rules.ts (months, sums by name). The pages turn the keys into words in the reader's
 * language (a month name, a role name...).
 *   - getProviderStats(): the provider's earnings per month and jobs per machine
 *   - getAdminStats():    bookings and platform fees per month, and accounts per role
 */
import type { BookingStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { getProviderShare } from "@/lib/services/booking-rules";
import { startOfDhakaDay } from "@/lib/services/calendar";
import { PAID_BOOKING_STATUSES } from "@/lib/services/payment-rules";
import { lastMonths, sumByKey, sumByMonth, type ChartPoint } from "@/lib/services/stats-rules";

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
