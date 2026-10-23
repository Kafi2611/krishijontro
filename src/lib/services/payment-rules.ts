/**
 * Payment rules — the small money decisions about payments, refunds and payouts.
 *
 * Everything here is a pure function (no database), so it is easy to test.
 *
 *   1. makeTransactionId(): our own id for one payment try, e.g. PAY-KJ-2026-000023-7F3A9C
 *   2. canPayBooking(): only a booking whose work is done (COMPLETED) waits for payment
 *   3. getRefundableAmount(): how much of a payment can still be given back
 *   4. getBookingMoney(): for one paid booking, what KrishiJontro still owes the provider
 */
import type { BookingStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { getProviderShare } from "@/lib/services/booking-rules";

// ─────────────────────────── 1. Transaction id ───────────────────────────

/**
 * Our own id for one payment try. The gateway sends it back to us, so we know which payment
 * it is talking about. The random part makes it impossible to guess somebody else's id.
 * Example: makeTransactionId("KJ-2026-000023") -> "PAY-KJ-2026-000023-7F3A9C"
 */
export function makeTransactionId(bookingCode: string): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(3));
  const randomPart = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `PAY-${bookingCode}-${randomPart.toUpperCase()}`;
}

// ─────────────────────────── 2. Which bookings can be paid ───────────────────────────

/**
 * True if the farmer can pay this booking now: the work is done (COMPLETED) and not paid yet.
 * The farmer pays after the work, because only then is the real area or hours known.
 */
export function canPayBooking(status: BookingStatus): boolean {
  return status === "COMPLETED";
}

/** Bookings whose money has come in (the farmer paid). Only these count for payouts. */
export const PAID_BOOKING_STATUSES: BookingStatus[] = ["PAID", "REVIEWED"];

// ─────────────────────────── 3. Refunds ───────────────────────────

/** Adds up the amounts of a list, e.g. all refunds of one payment. */
export function sumAmounts(items: { amount: number }[]): number {
  let total = 0;
  for (const item of items) {
    total += item.amount;
  }
  return total;
}

/**
 * How much of a payment can still be given back: what was paid − what was already refunded.
 * Never below 0. Example: paid 1517, refunded 200 before -> 1317 can still be refunded.
 */
export function getRefundableAmount(paidAmount: number, refunds: { amount: number }[]): number {
  return Math.max(0, paidAmount - sumAmounts(refunds));
}

// ─────────────────────────── 4. What we owe the provider ───────────────────────────

/** The parts of a paid booking that decide the provider's money. */
export type MoneyBooking = {
  workCharge: number;
  deliveryCharge: number;
  platformFee: number;
  payments: { method: PaymentMethod; status: PaymentStatus; amount: number }[];
  refunds: { amount: number }[]; // money given back to the farmer
};

/** The provider's money for one booking, every amount in whole taka. */
export type BookingMoney = {
  share: number; // the provider's part: work + delivery − platform fee
  cashTaken: number; // cash the operator took from the farmer (already with the provider)
  refunded: number; // money given back to the farmer
  owed: number; // what KrishiJontro still has to send = share − cashTaken − refunded
};

/**
 * For one paid booking: the provider's share, the cash they already have, the refunds,
 * and what KrishiJontro still owes them (see BookingMoney).
 * Refunds come out of the provider's share, because the work they billed is what was refunded.
 * "owed" can be below 0: after a cash job without subsidy the provider holds our platform fee,
 * and it is taken from their next payout.
 *
 * Example (the project's price example, 1584 + 250 − 55 = 1779 share):
 *   paid online           -> owed 1779
 *   paid 1517 in cash     -> owed 1779 − 1517 = 262 (the government's subsidy 317 − our fee 55)
 */
export function getBookingMoney(booking: MoneyBooking): BookingMoney {
  const share = getProviderShare(booking);
  const cashPayments = booking.payments.filter((payment) => payment.method === "CASH" && payment.status === "SUCCESS");
  const cashTaken = sumAmounts(cashPayments);
  const refunded = sumAmounts(booking.refunds);
  return { share, cashTaken, refunded, owed: share - cashTaken - refunded };
}
