/**
 * Officer service — small helpers about agriculture officers.
 *
 * Every officer works in exactly ONE upazila (OfficerProfile.upazilaId). They only see and
 * decide the farmers (and subsidy applications) of that upazila. A farmer's upazila is
 * FarmerProfile.locationId, chosen on the farmer's "NID and land" form.
 * The officer also SEES (but does not change) the bookings whose field is in their upazila
 * (Booking.locationId) and the complaints about them.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { OPEN_DISPUTES } from "@/lib/services/booking-queries";
import type { NewNotification } from "@/lib/services/notification";

/** The officer's upazila (id and names), or null if the officer has no profile. */
export async function getOfficerUpazila(officerId: string) {
  const profile = await db.officerProfile.findUnique({
    where: { userId: officerId },
    select: { upazila: { select: { id: true, name: true, nameBn: true } } },
  });
  return profile?.upazila ?? null;
}

/**
 * Sends the same message to every active officer of one upazila,
 * e.g. "A farmer sent their NID and land". Pass `tx` to save it inside a transaction.
 */
export async function notifyUpazilaOfficers(
  upazilaId: string,
  notification: Omit<NewNotification, "userId">,
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  const officers = await tx.user.findMany({
    where: { role: "OFFICER", status: "ACTIVE", officerProfile: { upazilaId } },
    select: { id: true },
  });
  await tx.notification.createMany({
    data: officers.map((officer) => ({ ...notification, userId: officer.id })),
  });
}

// ─────────────────────────── Bookings and complaints in the upazila ───────────────────────────

/** How many of the latest bookings the officer's page lists. */
const UPAZILA_BOOKINGS_TO_SHOW = 40;

/**
 * The bookings whose FIELD is in the officer's upazila (Booking.locationId), newest first, with
 * the farmer, the machine and its provider. The OTP codes are left out. Also counts every booking
 * there by status. Returns null if the officer has no upazila.
 */
export async function listUpazilaBookings(officerId: string) {
  const upazila = await getOfficerUpazila(officerId);
  if (!upazila) {
    return null;
  }
  const where = { locationId: upazila.id };
  const [bookings, groups] = await Promise.all([
    db.booking.findMany({
      where,
      omit: { startOtp: true, finishOtp: true },
      include: {
        farmer: { select: { name: true } },
        disputes: OPEN_DISPUTES, // for the status badge
        machine: {
          select: {
            brand: true,
            model: true,
            machineType: { select: { icon: true } },
            provider: { select: { name: true, providerProfile: { select: { businessName: true } } } },
          },
        },
      },
      orderBy: { startAt: "desc" },
      take: UPAZILA_BOOKINGS_TO_SHOW,
    }),
    db.booking.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  let total = 0;
  for (const group of groups) {
    total += group._count._all;
  }
  return { upazila, bookings, total, statusCounts: groups.map((group) => ({ status: group.status, count: group._count._all })) };
}

/**
 * The farmers' complaints about jobs in the officer's upazila: open ones first, then the latest
 * decided ones. The officer only reads them; an admin decides. Returns [] without an upazila.
 */
export async function listUpazilaComplaints(officerId: string) {
  const upazila = await getOfficerUpazila(officerId);
  if (!upazila) {
    return [];
  }
  const disputes = await db.dispute.findMany({
    where: { booking: { locationId: upazila.id } },
    include: {
      raisedBy: { select: { name: true } },
      resolvedBy: { select: { name: true } },
      booking: {
        select: {
          code: true,
          machine: { select: { brand: true, model: true } },
          statusLogs: { where: { toStatus: "DISPUTED" }, select: { fromStatus: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  // Open complaints first; inside each group the newest first (the order of the query).
  const open = disputes.filter((dispute) => dispute.status === "OPEN");
  const decided = disputes.filter((dispute) => dispute.status !== "OPEN");
  return [...open, ...decided].map((dispute) => ({
    ...dispute,
    wasPaid: dispute.booking.statusLogs[0]?.fromStatus === "PAID",
  }));
}

/** How many complaints about jobs in the officer's upazila wait for a decision. For the dashboard. */
export async function countUpazilaOpenComplaints(officerId: string): Promise<number> {
  const upazila = await getOfficerUpazila(officerId);
  if (!upazila) {
    return 0;
  }
  return db.dispute.count({ where: { status: "OPEN", booking: { locationId: upazila.id } } });
}
