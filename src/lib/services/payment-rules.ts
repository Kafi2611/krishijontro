/**
 * Payment rules — the small money decisions about payments, refunds and payouts.
 *
 * Everything here is a pure function (no database), so it is easy to test.
 *
 *   1. makeTransactionId(): our own id for one payment try, e.g. PAY-KJ-2026-000023-7F3A9C
 *   2. canPayBooking(): a booking whose work is done (COMPLETED) waits for payment, and so does
 *      one the farmer complained about before paying, once the admin has decided the complaint
 *   3. getRefundableAmount(): how much of a payment can still be given back
 *   4. getBookingMoney(): for one paid booking, what KrishiJontro still owes the provider
 */
import type { BookingStatus, PaymentMethod, PaymentStatus, RefundStatus } from "@/generated/prisma/enums";
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
 * True if the farmer can pay this booking now:
 * - the work is done (COMPLETED) and not paid yet, or
 * - the farmer complained BEFORE paying (DISPUTED) and the admin has decided the complaint
 *   (maybe with a lower bill). Paying then moves it DISPUTED -> PAID.
 * While a complaint is open nobody can pay, because the bill may still change.
 * (A booking that was paid before its complaint goes back to PAID when the admin decides,
 * so it never waits for payment again.)
 * The farmer pays after the work, because only then is the real area or hours known.
 */
export function canPayBooking(status: BookingStatus, hasOpenDispute: boolean): boolean {
  if (status === "COMPLETED") {
    return true;
  }
  return status === "DISPUTED" && !hasOpenDispute;
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
 * A FAILED refund gave nothing back (the gateway did not send the money), so it is not counted.
 * A PENDING one is counted, so the same money can never be given back twice.
 * Never below 0. Example: paid 1517, refunded 200 before -> 1317 can still be refunded.
 */
export function getRefundableAmount(paidAmount: number, refunds: { amount: number; status: RefundStatus }[]): number {
  const countedRefunds = refunds.filter((refund) => refund.status !== "FAILED");
  return Math.max(0, paidAmount - sumAmounts(countedRefunds));
}

// ─────────────────────────── 4. What we owe the provider ───────────────────────────

/** The parts of a paid booking that decide the provider's money. */
export type MoneyBooking = {
  workCharge: number;
  deliveryCharge: number;
  platformFee: number;
  payments: { method: PaymentMethod; status: PaymentStatus; amount: number }[];
  refunds: { amount: number }[]; // money given back to the farmer
  disputes: { penaltyAmount: number }[]; // complaints about the booking (a fine the admin decided)
};

/** The provider's money for one booking, every amount in whole taka. */
export type BookingMoney = {
  share: number; // the provider's part: work + delivery − platform fee
  cashTaken: number; // cash the operator took from the farmer (already with the provider)
  refunded: number; // money given back to the farmer
  fined: number; // fines the admin decided on a complaint (the provider pays them)
  owed: number; // what KrishiJontro still has to send = share − cashTaken − refunded − fined
};

/**
 * For one paid booking: the provider's share, the cash they already have, the refunds, the
 * fines, and what KrishiJontro still owes them (see BookingMoney).
 * Refunds come out of the provider's share, because the work they billed is what was refunded.
 * A fine (a complaint decision) comes out of it too: KrishiJontro keeps that money.
 * "owed" can be below 0: after a cash job without subsidy the provider holds our platform fee,
 * and it is taken from their next payout.
 *
 * Example (the project's price example, 1584 + 250 − 55 = 1779 share):
 *   paid online           -> owed 1779
 *   paid 1517 in cash     -> owed 1779 − 1517 = 262 (the government's subsidy 317 − our fee 55)
 *   paid online, fined 300 -> owed 1779 − 300 = 1479
 */
export function getBookingMoney(booking: MoneyBooking): BookingMoney {
  const share = getProviderShare(booking);
  const cashPayments = booking.payments.filter((payment) => payment.method === "CASH" && payment.status === "SUCCESS");
  const cashTaken = sumAmounts(cashPayments);
  const refunded = sumAmounts(booking.refunds);
  let fined = 0;
  for (const dispute of booking.disputes) {
    fined += dispute.penaltyAmount;
  }
  return { share, cashTaken, refunded, fined, owed: share - cashTaken - refunded - fined };
}
