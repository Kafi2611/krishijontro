/**
 * Breakdown rules — the small calculations when a machine breaks down in the middle of a job.
 *
 * Everything here is a pure function (no database), so it is easy to test and the
 * operator's breakdown form can use it too.
 *
 *   1. The work: how much was booked, how much was done, how much is left.
 *   2. The replacement job's time: it starts once the other machine has driven to the field.
 *   3. The two bills. A breakdown must never make the farmer pay more than they booked:
 *      - the broken machine is paid only for the work it did (plus its delivery: it did come)
 *      - the replacement machine does the rest at the same rate, with free delivery
 *      Neither bill uses the minimum charge, because a breakdown cut the job in two.
 *   4. The order of the replacement machines: nearest first, then the more trusted provider.
 */
import type { BillingUnit } from "@/generated/prisma/enums";
import { estimateWorkHours } from "@/lib/services/booking-rules";
import { DECIMALS_PER_ACRE } from "@/lib/services/geo";
import { billFromCharges, getBillingQuantity, type Bill } from "@/lib/services/pricing";

const HOUR_MS = 60 * 60 * 1000;

/** A replacement machine needs about this long to reach the field, so its job starts this many hours from now. */
export const REPLACEMENT_TRAVEL_HOURS = 1;

// ─────────────────────────── 1. The work ───────────────────────────

/** The booking fields that say how much work was booked. */
type BookedWork = {
  billingUnit: BillingUnit;
  landDecimal: number;
  quantity: number; // acres, hours or days
};

/**
 * How much work was booked, in the unit the operator types:
 * decimal of land for machines rented per acre, otherwise hours or days.
 * Example: 66 decimal of tilling -> 66; a pump booked for 6 hours -> 6
 */
export function getBookedAmount(booking: BookedWork): number {
  if (booking.billingUnit === "PER_ACRE") {
    return booking.landDecimal;
  }
  return booking.quantity;
}

/**
 * True if `doneAmount` can be the work done before a breakdown: not below 0, and less than what
 * was booked. (If ALL the work is done, the operator presses Finish instead.)
 */
export function isDoneAmountValid(booking: BookedWork, doneAmount: number): boolean {
  return doneAmount >= 0 && doneAmount < getBookedAmount(booking);
}

/**
 * The work done, in the billing unit (acres, hours or days), from what the operator typed.
 * Example: getDoneQuantity("PER_ACRE", 40) -> 0.4 (acre); getDoneQuantity("PER_HOUR", 3) -> 3
 */
export function getDoneQuantity(billingUnit: BillingUnit, doneAmount: number): number {
  return getBillingQuantity(billingUnit, doneAmount, doneAmount);
}

/** Rounds to 2 decimals, so 66 − 40.3 gives 25.7 and not 25.700000000000003. */
function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The work the replacement machine must still do, after `doneAmount` (the operator's unit) was done.
 * - per acre: the land that is left (decimal), and the same land in acres as the quantity
 * - per hour / per day: the same field, and the hours or days that are left
 * Example: 66 decimal booked, 40 done -> { landDecimal: 26, quantity: 0.26 }
 */
export function getRemainingWork(booking: BookedWork, doneAmount: number): { landDecimal: number; quantity: number } {
  if (booking.billingUnit === "PER_ACRE") {
    const landDecimal = roundTo2(booking.landDecimal - doneAmount);
    return { landDecimal, quantity: roundTo2(landDecimal / DECIMALS_PER_ACRE) };
  }
  return { landDecimal: booking.landDecimal, quantity: roundTo2(booking.quantity - doneAmount) };
}

// ─────────────────────────── 2. The replacement job's time ───────────────────────────

/**
 * When the replacement job starts and ends: it starts REPLACEMENT_TRAVEL_HOURS from now and
 * lasts as long as the work left takes (estimateWorkHours, the same as for any booking).
 * Example: now 10:00, 0.26 acre left -> 11:00 to 12:00
 */
export function getReplacementTimeRange(
  billingUnit: BillingUnit,
  remainingQuantity: number,
  now: Date = new Date(),
): { startAt: Date; endAt: Date } {
  const startAt = new Date(now.getTime() + REPLACEMENT_TRAVEL_HOURS * HOUR_MS);
  const endAt = new Date(startAt.getTime() + estimateWorkHours(billingUnit, remainingQuantity) * HOUR_MS);
  return { startAt, endAt };
}

/**
 * The moment the admin may say "no replacement found": `timeoutHours` after the breakdown.
 * Example: broke down at 10:00, timeout 2 hours -> 12:00
 */
export function getReplacementDeadline(reportedAt: Date, timeoutHours: number): Date {
  return new Date(reportedAt.getTime() + timeoutHours * HOUR_MS);
}

// ─────────────────────────── 3. The two bills ───────────────────────────

/** What both bills need from the booking that broke down. */
type BrokenBooking = {
  rateSnapshot: number; // the rate the farmer booked at
  deliveryCharge: number;
};

/** The two percents every bill needs. */
export type BillPercents = {
  subsidyPercent: number; // 0 when the farmer has no subsidy
  platformFeePercent: number;
};

/**
 * The broken machine's bill: only the work it did, at the booked rate, plus its delivery
 * charge (it did come to the field). No minimum charge.
 * Example: 0.4 acre done at 2400, delivery 250, 20% subsidy, 3% fee
 *          -> work 960, delivery 250, subsidy 192, farmer pays 1018
 */
export function billWorkDone(booking: BrokenBooking, doneQuantity: number, percents: BillPercents): Bill {
  const workCharge = Math.round(doneQuantity * booking.rateSnapshot);
  return billFromCharges(
    { workCharge, deliveryCharge: booking.deliveryCharge },
    percents.subsidyPercent,
    percents.platformFeePercent,
  );
}

/**
 * The replacement machine's bill: the work left, at the rate the farmer BOOKED (the price they
 * agreed to), with free delivery. No minimum charge.
 * Example: 0.26 acre left at 2400, 20% subsidy, 3% fee -> work 624, subsidy 125, farmer pays 499
 * Together with the example above: 1018 + 499 = 1517, the same as the job without a breakdown.
 */
export function billReplacement(booking: BrokenBooking, remainingQuantity: number, percents: BillPercents): Bill {
  const workCharge = Math.round(remainingQuantity * booking.rateSnapshot);
  return billFromCharges({ workCharge, deliveryCharge: 0 }, percents.subsidyPercent, percents.platformFeePercent);
}

// ─────────────────────────── 4. The order of the replacement machines ───────────────────────────

/**
 * Sorts possible replacement machines (returns a new list): nearest first; at the same
 * distance, the provider with the higher trust score first.
 */
export function sortReplacementMachines<T extends { distanceKm: number; trustScore: number }>(machines: T[]): T[] {
  return [...machines].sort((a, b) => a.distanceKm - b.distanceKm || b.trustScore - a.trustScore);
}
