/**
 * Dispute rules — the small decisions about complaints ("disputes"), with no database,
 * so they are easy to test and the booking pages can use them to decide what to show.
 *
 * A farmer may complain about a finished job, once per booking:
 *   - BEFORE paying (COMPLETED -> DISPUTED): e.g. "the operator wrote 0.8 acre, but only 0.6
 *     acre was done". Nobody can pay while the complaint is open.
 *   - AFTER paying (PAID -> DISPUTED): e.g. "the work was badly done".
 * The admin decides one of three things:
 *   - REFUND: before paying, the admin corrects the amount of work and the bill is worked out
 *     again (lower); after paying, the admin gives part of the money back.
 *   - PENALTY: the provider is fined; the fine comes off their next payout.
 *   - NO_ACTION: nothing changes.
 * Then a paid booking goes back to PAID, and an unpaid one can be paid (the new bill, if lowered).
 */
import type { BillingUnit, BookingStatus, DisputeDecision } from "@/generated/prisma/enums";
import { DECIMALS_PER_ACRE } from "@/lib/services/geo";

/** The reasons a farmer can choose. Saved in Dispute.reason; each has a name in messages/*.json. */
export const DISPUTE_REASONS = [
  "WRONG_AMOUNT", // the area or hours written by the operator are wrong
  "BAD_WORK", // the work was badly done
  "LATE", // the machine came very late
  "OPERATOR_BEHAVIOUR", // the operator was rude or careless
  "DAMAGE", // the machine damaged the field, crop or a fence
  "OTHER",
] as const;

export type DisputeReason = (typeof DISPUTE_REASONS)[number];

/** The admin's three possible decisions, in the order the form shows them. */
export const DISPUTE_DECISIONS: DisputeDecision[] = ["REFUND", "PENALTY", "NO_ACTION"];

/** The statuses a complaint can start from: the work is done (paid or not yet). */
export const DISPUTE_FROM_STATUSES: BookingStatus[] = ["COMPLETED", "PAID"];

/**
 * True if the farmer may complain about this booking now: the work is done (COMPLETED or PAID)
 * and they have not complained about it before (one complaint per booking).
 * After a review (REVIEWED) the booking is closed, so no complaint any more.
 */
export function canRaiseDispute(status: BookingStatus, hasEarlierDispute: boolean): boolean {
  return DISPUTE_FROM_STATUSES.includes(status) && !hasEarlierDispute;
}

/**
 * True if a fine is allowed: at least 1 Tk, and not more than the provider's share of the
 * booking (we cannot take more than they earned from it).
 * Example: provider share 1779 -> a fine of 300 is fine, 2000 is too much
 */
export function isFineAllowed(penaltyAmount: number, providerShare: number): boolean {
  return penaltyAmount >= 1 && penaltyAmount <= providerShare;
}

/**
 * The work on the bill now, written the way the operator typed it at the finish: decimal of land
 * for machines rented per acre, otherwise hours or days. The admin's "right amount of work"
 * box uses the same unit. Rounded to 1 decimal place (0.66 × 100 gives 66.00000000000001 in JavaScript).
 * Example: PER_ACRE, 0.66 acre -> 66 (decimal); PER_HOUR, 5 -> 5 (hours)
 */
export function getBilledWork(booking: { billingUnit: BillingUnit; quantity: number; actualQuantity: number | null }): number {
  const quantity = booking.actualQuantity ?? booking.quantity;
  const work = booking.billingUnit === "PER_ACRE" ? quantity * DECIMALS_PER_ACRE : quantity;
  return Math.round(work * 10) / 10;
}
