/**
 * Cancellation rules — who may cancel a booking, and when the farmer pays a fee.
 *
 * Everything here is a pure function (no database), so it is easy to test and the booking
 * pages can use it to decide which buttons to show.
 *
 * - The FARMER may cancel until the operator sets off (REQUESTED, ACCEPTED, OPERATOR_ASSIGNED).
 *   It is free while the provider has not accepted yet, and free until `freeHours` (24) hours
 *   before the start. Later, the fee is `feePercent` (10%) of the work charge.
 *   Both numbers are platform Settings that the admin can change.
 * - The PROVIDER may cancel a booking they accepted (ACCEPTED, OPERATOR_ASSIGNED), with a reason.
 *   The farmer pays nothing, and the provider's trust score goes down (trust-rules.ts).
 *
 * Farmers pay only after the work, so a cancelled booking was never paid: there is no money to
 * give back. A "full refund" after the provider cancels means: the farmer owes nothing at all.
 */
import type { BookingStatus } from "@/generated/prisma/enums";

const HOUR_MS = 60 * 60 * 1000;

/** Used when the setting is missing: cancelling is free until 24 hours before the start. */
export const DEFAULT_FREE_CANCELLATION_HOURS = 24;

/** Used when the setting is missing: a late cancellation costs 10% of the work charge. */
export const DEFAULT_CANCELLATION_FEE_PERCENT = 10;

/** The two cancellation settings. */
export type CancellationRules = {
  freeHours: number; // free until this many hours before the start
  feePercent: number; // the late fee, as a % of the work charge
};

/** Statuses in which the farmer may still cancel: the operator has not set off yet. */
export const FARMER_CANCEL_STATUSES: BookingStatus[] = ["REQUESTED", "ACCEPTED", "OPERATOR_ASSIGNED"];

/** Statuses in which the provider may cancel: they accepted, but the operator has not set off yet. */
export const PROVIDER_CANCEL_STATUSES: BookingStatus[] = ["ACCEPTED", "OPERATOR_ASSIGNED"];

/** True if the farmer may cancel a booking in this status. */
export function canFarmerCancel(status: BookingStatus): boolean {
  return FARMER_CANCEL_STATUSES.includes(status);
}

/** True if the provider may cancel a booking in this status. (A new request is rejected instead.) */
export function canProviderCancel(status: BookingStatus): boolean {
  return PROVIDER_CANCEL_STATUSES.includes(status);
}

/**
 * The last moment the farmer can cancel for free: `freeHours` before the start.
 * Example: start 20 Oct 8:00 AM, 24 free hours -> 19 Oct 8:00 AM
 */
export function getFreeCancellationEnd(startAt: Date, freeHours: number): Date {
  return new Date(startAt.getTime() - freeHours * HOUR_MS);
}

/**
 * The fee the farmer pays for cancelling now (whole taka):
 * - 0 if the provider has not accepted yet (nothing was planned for this booking)
 * - 0 until `freeHours` before the start
 * - otherwise feePercent of the work charge
 * Example: work 1584 Tk, cancelled 5 hours before the start, 10% -> 158
 */
export function getCancellationFee(
  booking: { status: BookingStatus; startAt: Date; workCharge: number },
  rules: CancellationRules,
  now: Date = new Date(),
): number {
  if (booking.status === "REQUESTED") {
    return 0;
  }
  if (now <= getFreeCancellationEnd(booking.startAt, rules.freeHours)) {
    return 0;
  }
  return Math.round((booking.workCharge * rules.feePercent) / 100);
}
