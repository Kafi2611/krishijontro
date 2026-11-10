/**
 * Payout service — sending providers the money they earned.
 *
 * When a farmer pays online, the money comes to KrishiJontro (and the government pays the
 * subsidy part), so we hold the provider's share until the admin sends it, e.g. by bKash.
 * That transfer is a "payout". For a cash job it is the other way round: the operator already
 * has the farmer's cash, so the provider owes us our platform fee.
 *
 * What we owe a provider is a running balance, like a bank statement (getProviderBalance in
 * payment-rules.ts):
 *     what ALL their paid bookings are worth now (share − cash taken − refunds − fines)
 *   − every payout already sent to them
 * createPayout() sends exactly that balance as ONE Payout row and marks the bookings that were
 * not in a payout yet (Booking.payoutId), so a booking is never paid out twice.
 * A refund or a fine decided AFTER a booking was paid out makes that booking worth less than
 * what was sent for it. The balance goes down by the same amount, so it is carried forward:
 * it comes off the provider's next payout by itself.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notification";
import { payoutSentMessage } from "@/lib/services/payment-messages";
import { getBookingMoney, getProviderBalance, PAID_BOOKING_STATUSES, sumAmounts } from "@/lib/services/payment-rules";
import type { ActionResult } from "@/lib/validators/types";

/** What a paid booking needs to work out the provider's money, and to be listed. */
const MONEY_FIELDS = {
  payments: { select: { method: true, status: true, amount: true } },
  refunds: { where: { status: "PROCESSED" }, select: { amount: true } },
  disputes: { where: { status: "RESOLVED" }, select: { penaltyAmount: true } }, // fines from complaints
  machine: { select: { brand: true, model: true, providerId: true } },
} satisfies Prisma.BookingInclude;

/**
 * Every paid booking that matches `where` (in a payout or not), each with its money (share,
 * cash taken, refunded, fined, owed), oldest first. Works inside a transaction too (tx).
 */
async function listPaidBookings(where: Prisma.BookingWhereInput, tx: Prisma.TransactionClient = db) {
  const bookings = await tx.booking.findMany({
    where: { ...where, status: { in: PAID_BOOKING_STATUSES } },
    include: MONEY_FIELDS,
    orderBy: { completedAt: "asc" },
  });
  return bookings.map((booking) => ({ ...booking, money: getBookingMoney(booking) }));
}

type PaidBooking = Awaited<ReturnType<typeof listPaidBookings>>[number];

/**
 * A provider's balance from their paid bookings and the total already sent to them:
 * the bookings still waiting for a payout, and the three numbers of getProviderBalance.
 */
function workOutBalance(bookings: PaidBooking[], payoutsTotal: number) {
  const waiting = bookings.filter((booking) => booking.payoutId === null);
  const balance = getProviderBalance(
    bookings.map((booking) => ({ owed: booking.money.owed, isPaidOut: booking.payoutId !== null })),
    payoutsTotal,
  );
  return { waiting, ...balance };
}

/** One provider's paid bookings and payouts so far, turned into their balance. Works inside a transaction too. */
async function getProviderMoney(providerId: string, tx: Prisma.TransactionClient = db) {
  const bookings = await listPaidBookings({ machine: { providerId } }, tx);
  const sent = await tx.payout.aggregate({ where: { providerId, status: "PAID" }, _sum: { amount: true } });
  return workOutBalance(bookings, sent._sum.amount ?? 0);
}

// ─────────────────────────── The provider's Earnings page ───────────────────────────

/**
 * Everything the provider's Earnings page shows:
 * - waiting: paid bookings not paid out yet (with their money) and their total
 * - carriedForward: refunds and fines decided after an earlier payout (0 or below)
 * - balance: what the next payout sends = waitingTotal + carriedForward
 * - payouts: the payouts already sent (newest first) and their total
 * - earnedTotal: the provider's share of every paid booking so far
 */
export async function getProviderEarnings(providerId: string) {
  const [money, payouts, allPaid] = await Promise.all([
    getProviderMoney(providerId),
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
  return { ...money, payouts, paidOutTotal: sumAmounts(payouts), earnedTotal };
}

/** Only what the next payout would send the provider (for their dashboard). */
export async function getProviderWaitingTotal(providerId: string): Promise<number> {
  const money = await getProviderMoney(providerId);
  return money.balance;
}

// ─────────────────────────── The admin's payouts ───────────────────────────

/**
 * Every provider whose balance is not settled: who they are, where to send the money, how many
 * paid bookings wait, the amount carried forward and what to send now (biggest first).
 * For the admin's Payments page. It reads all paid bookings and all payout totals in two
 * queries, then groups them by provider here.
 */
export async function listProvidersToPay() {
  const [bookings, payoutSums] = await Promise.all([
    listPaidBookings({}),
    db.payout.groupBy({ by: ["providerId"], where: { status: "PAID" }, _sum: { amount: true } }),
  ]);

  // Group the bookings by provider: providerId -> that provider's paid bookings.
  const bookingsByProvider = new Map<string, PaidBooking[]>();
  for (const booking of bookings) {
    const providerId = booking.machine.providerId;
    const list = bookingsByProvider.get(providerId) ?? [];
    list.push(booking);
    bookingsByProvider.set(providerId, list);
  }
  const sentByProvider = new Map(payoutSums.map((row) => [row.providerId, row._sum.amount ?? 0]));

  // Keep the providers who have bookings waiting, or an amount carried forward.
  const groups = new Map<string, { bookingCount: number; carriedForward: number; owed: number }>();
  for (const [providerId, providerBookings] of bookingsByProvider) {
    const money = workOutBalance(providerBookings, sentByProvider.get(providerId) ?? 0);
    if (money.waiting.length > 0 || money.carriedForward !== 0) {
      groups.set(providerId, { bookingCount: money.waiting.length, carriedForward: money.carriedForward, owed: money.balance });
    }
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
 * In one transaction: lock the provider (so two admins cannot pay them twice at once), work out
 * their balance, save ONE Payout for it, mark the bookings that waited, write the audit log and
 * tell the provider. Refused ("nothingToPay") if the balance is 0 or less.
 */
export async function createPayout(providerId: string, adminId: string, reference: string): Promise<ActionResult> {
  const sent = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${providerId} FOR UPDATE`;
    const { waiting, carriedForward, balance } = await getProviderMoney(providerId, tx);
    if (balance <= 0) {
      return false; // nothing was saved yet, so there is nothing to undo
    }

    const payout = await tx.payout.create({
      data: { providerId, amount: balance, status: "PAID", reference, paidAt: new Date() },
    });
    // Mark the bookings with this payout, so they are never paid out again.
    await tx.booking.updateMany({
      where: { id: { in: waiting.map((booking) => booking.id) } },
      data: { payoutId: payout.id },
    });
    const carriedNote = carriedForward !== 0 ? ` (${carriedForward} Tk carried forward from earlier payouts)` : "";
    await writeAuditLog(
      {
        actorId: adminId,
        action: "PAYOUT_SENT",
        entityType: "Payout",
        entityId: payout.id,
        details: `Sent ${balance} Tk for ${waiting.length} booking(s)${carriedNote}, reference ${reference}`,
      },
      tx,
    );
    await createNotification(
      { userId: providerId, channel: "SMS", ...payoutSentMessage(balance, waiting.length, reference) },
      tx,
    );
    return true;
  });
  return sent ? { ok: true } : { ok: false, error: "nothingToPay" };
}
