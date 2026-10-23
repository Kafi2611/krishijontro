/**
 * Payout service — sending providers the money they earned.
 *
 * When a farmer pays online, the money comes to KrishiJontro (and the government pays the
 * subsidy part), so we hold the provider's share until the admin sends it, e.g. by bKash.
 * That transfer is a "payout". For a cash job it is the other way round: the operator already
 * has the farmer's cash, so the provider owes us our platform fee.
 *
 * For every paid booking that is not in a payout yet, getBookingMoney (payment-rules.ts) works
 * out what we still owe: the provider's share − cash already taken − refunds.
 * createPayout() puts ALL those bookings of one provider into ONE Payout row and sets their
 * Booking.payoutId, so a booking can never be paid out twice.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notification";
import { payoutSentMessage } from "@/lib/services/payment-messages";
import { getBookingMoney, PAID_BOOKING_STATUSES, sumAmounts } from "@/lib/services/payment-rules";
import type { ActionResult } from "@/lib/validators/types";

/** What a paid booking needs to work out the provider's money, and to be listed. */
const MONEY_FIELDS = {
  payments: { select: { method: true, status: true, amount: true } },
  refunds: { where: { status: "PROCESSED" }, select: { amount: true } },
  machine: { select: { brand: true, model: true, providerId: true } },
} satisfies Prisma.BookingInclude;

/**
 * The paid bookings of the given providers' machines that are not in a payout yet, each with
 * its money (share, cash taken, refunded, owed). Works inside a transaction too (tx).
 */
async function listUnpaidBookings(where: Prisma.BookingWhereInput, tx: Prisma.TransactionClient = db) {
  const bookings = await tx.booking.findMany({
    where: { ...where, status: { in: PAID_BOOKING_STATUSES }, payoutId: null },
    include: MONEY_FIELDS,
    orderBy: { completedAt: "asc" },
  });
  return bookings.map((booking) => ({ ...booking, money: getBookingMoney(booking) }));
}

/** Adds up what is owed for a list of bookings. */
function totalOwed(bookings: { money: { owed: number } }[]): number {
  let total = 0;
  for (const booking of bookings) {
    total += booking.money.owed;
  }
  return total;
}

// ─────────────────────────── The provider's Earnings page ───────────────────────────

/**
 * Everything the provider's Earnings page shows:
 * - waiting: paid bookings not paid out yet (with their money) and their total
 * - payouts: the payouts already sent (newest first) and their total
 * - earnedTotal: the provider's share of every paid booking so far
 */
export async function getProviderEarnings(providerId: string) {
  const [waiting, payouts, allPaid] = await Promise.all([
    listUnpaidBookings({ machine: { providerId } }),
    db.payout.findMany({
      where: { providerId },
      include: { _count: { select: { bookings: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.booking.findMany({
      where: { machine: { providerId }, status: { in: PAID_BOOKING_STATUSES } },
      select: { workCharge: true, deliveryCharge: true, platformFee: true },
    }),
  ]);

  let earnedTotal = 0;
  for (const booking of allPaid) {
    earnedTotal += booking.workCharge + booking.deliveryCharge - booking.platformFee;
  }
  return {
    waiting,
    waitingTotal: totalOwed(waiting),
    payouts,
    paidOutTotal: sumAmounts(payouts),
    earnedTotal,
  };
}

/** Only the total waiting for the provider (for their dashboard). */
export async function getProviderWaitingTotal(providerId: string): Promise<number> {
  return totalOwed(await listUnpaidBookings({ machine: { providerId } }));
}

// ─────────────────────────── The admin's payouts ───────────────────────────

/**
 * Every provider with paid bookings not paid out yet: who they are, where to send the money,
 * how many bookings and the total owed (biggest first). For the admin's Payments page.
 */
export async function listProvidersToPay() {
  const bookings = await listUnpaidBookings({});

  // Group the bookings by provider: providerId -> { count, owed }
  const groups = new Map<string, { bookingCount: number; owed: number }>();
  for (const booking of bookings) {
    const providerId = booking.machine.providerId;
    const group = groups.get(providerId) ?? { bookingCount: 0, owed: 0 };
    group.bookingCount += 1;
    group.owed += booking.money.owed;
    groups.set(providerId, group);
  }

  const providers = await db.user.findMany({
    where: { id: { in: [...groups.keys()] } },
    select: { id: true, name: true, phone: true, providerProfile: { select: { businessName: true, payoutAccount: true } } },
  });
  return providers
    .map((provider) => ({ provider, ...groups.get(provider.id)! }))
    .sort((a, b) => b.owed - a.owed);
}

/** How many providers we owe money to right now (more than 0 Tk). For the admin dashboard. */
export async function countProvidersToPay(): Promise<number> {
  const providers = await listProvidersToPay();
  return providers.filter((item) => item.owed > 0).length;
}

/** The latest payouts of every provider, for the admin's Payments page. */
export async function listRecentPayouts(take = 30) {
  return db.payout.findMany({
    include: {
      provider: { select: { name: true, providerProfile: { select: { businessName: true } } } },
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * The admin has sent a provider their money (e.g. by bKash) and types the transfer's reference.
 * In one transaction: lock the provider (so two admins cannot pay them twice at once), add up
 * every paid booking not paid out yet, save ONE Payout for them, write the audit log and tell
 * the provider. Refused ("nothingToPay") if the total is 0 or less.
 */
export async function createPayout(providerId: string, adminId: string, reference: string): Promise<ActionResult> {
  const sent = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${providerId} FOR UPDATE`;
    const bookings = await listUnpaidBookings({ machine: { providerId } }, tx);
    const amount = totalOwed(bookings);
    if (bookings.length === 0 || amount <= 0) {
      return false; // nothing was saved yet, so there is nothing to undo
    }

    const payout = await tx.payout.create({
      data: { providerId, amount, status: "PAID", reference, paidAt: new Date() },
    });
    // Mark the bookings with this payout, so they are never paid out again.
    await tx.booking.updateMany({
      where: { id: { in: bookings.map((booking) => booking.id) } },
      data: { payoutId: payout.id },
    });
    await writeAuditLog(
      {
        actorId: adminId,
        action: "PAYOUT_SENT",
        entityType: "Payout",
        entityId: payout.id,
        details: `Sent ${amount} Tk for ${bookings.length} booking(s), reference ${reference}`,
      },
      tx,
    );
    await createNotification(
      { userId: providerId, channel: "SMS", ...payoutSentMessage(amount, bookings.length, reference) },
      tx,
    );
    return true;
  });
  return sent ? { ok: true } : { ok: false, error: "nothingToPay" };
}
