/**
 * Pricing service — the money rules of KrishiJontro.
 *
 * Part 1 (Phase 2): government rate limits.
 *   The government sets a minimum and maximum rate for each machine type
 *   (a PricingRule). A provider may only set a rate inside [minRate, maxRate].
 *   During the harvest season the maximum may rise by seasonCapPercent.
 *   Example: tractor 2000–3000 Tk per acre with a 10% season cap
 *            -> outside the season: 2000–3000, inside the season: 2000–3300.
 *
 * Part 2 (Phase 3): the price of a booking.
 *   workCharge     = max(quantity, minCharge) × rate        (quantity in acres, hours or days)
 *   deliveryCharge = max(0, distanceKm − freeKm) × deliveryRatePerKm
 *   subsidyAmount  = workCharge × subsidy %                 (0 if the farmer has no subsidy)
 *   totalAmount    = workCharge + deliveryCharge − subsidyAmount   <- the farmer pays this
 *   platformFee    = (workCharge + deliveryCharge) × platform fee %
 *   providerAmount = workCharge + deliveryCharge − platformFee     <- the provider gets this
 *   Every amount is rounded to whole taka.
 *
 * Part 3: one job on one machine (estimateJob). It measures the distance from the
 *   machine to the field and prices the job. The search, the machine page, the booking
 *   form (live, in the browser) and the booking service all use it, so they always agree.
 *
 * Everything here is a pure function (no database), so it is easy to test
 * and can also run in the browser (the price calculator and the forms use it).
 */
import type { BillingUnit } from "@/generated/prisma/enums";
import { decimalToAcre, distanceInKm, type LatLng } from "@/lib/services/geo";

// ─────────────────────────── Part 1: rate limits ───────────────────────────

/** The parts of a PricingRule that decide the allowed rate. */
export type RateLimitRule = {
  minRate: number;
  maxRate: number;
  seasonCapPercent: number;
  harvestSeasonStart: Date | null;
  harvestSeasonEnd: Date | null;
};

/** The lowest and highest rate a provider may use on a given day. */
export type RateRange = {
  minRate: number;
  maxRate: number;
  inHarvestSeason: boolean;
};

/**
 * True if the date falls inside the rule's harvest season (both ends included).
 * A rule without season dates has no harvest season.
 */
export function isInHarvestSeason(rule: RateLimitRule, date: Date): boolean {
  if (!rule.harvestSeasonStart || !rule.harvestSeasonEnd) {
    return false;
  }
  return date >= rule.harvestSeasonStart && date <= rule.harvestSeasonEnd;
}

/**
 * The highest rate allowed during the harvest season: maxRate raised by seasonCapPercent,
 * rounded DOWN to whole taka (so we never allow more than the cap).
 * Example: maxRate 3000, cap 10% -> 3300.
 */
export function getSeasonMaxRate(rule: { maxRate: number; seasonCapPercent: number }): number {
  return Math.floor((rule.maxRate * (100 + rule.seasonCapPercent)) / 100);
}

/**
 * Returns the allowed rate range on a given day.
 * In the harvest season the maximum goes up (see getSeasonMaxRate).
 * Example: maxRate 3000, cap 10%, in season -> maxRate 3300.
 */
export function getAllowedRateRange(rule: RateLimitRule, date: Date = new Date()): RateRange {
  const inHarvestSeason = isInHarvestSeason(rule, date);
  let maxRate = rule.maxRate;
  if (inHarvestSeason) {
    maxRate = getSeasonMaxRate(rule);
  }
  return { minRate: rule.minRate, maxRate, inHarvestSeason };
}

/**
 * True if the rate is inside the range (both ends allowed).
 * Example: isRateAllowed(2400, { minRate: 2000, maxRate: 3000 }) -> true
 */
export function isRateAllowed(rate: number, range: { minRate: number; maxRate: number }): boolean {
  return rate >= range.minRate && rate <= range.maxRate;
}

// ─────────────────────────── Part 2: the price of a booking ───────────────────────────

/**
 * How much work is billed, in the machine's billing unit:
 * acres for PER_ACRE (from the land size), otherwise the hours or days the farmer asked for.
 * Example: getBillingQuantity("PER_ACRE", 66, 0) -> 0.66 (acre)
 *          getBillingQuantity("PER_HOUR", 66, 5) -> 5 (hours)
 */
export function getBillingQuantity(
  billingUnit: BillingUnit,
  landDecimal: number,
  hoursOrDays: number,
): number {
  if (billingUnit === "PER_ACRE") {
    return decimalToAcre(landDecimal);
  }
  return hoursOrDays;
}

/** Everything needed to work out the price of one job. */
export type BookingPriceInput = {
  quantity: number; // acres, hours or days of work (see getBillingQuantity)
  rate: number; // the machine's rate in taka per acre / hour / day
  minCharge: number; // the smallest quantity we bill, from the price rule (e.g. 0.5 acre)
  distanceKm: number; // from the machine to the farmer's field
  freeKm: number; // the first km of delivery cost nothing
  deliveryRatePerKm: number; // taka for each km after the free km
  subsidyPercent: number; // e.g. 20; use 0 when the farmer has no approved subsidy
  platformFeePercent: number; // e.g. 3; taken from the provider's share, not added for the farmer
};

/** The full price of a job, every amount in whole taka (Bill is defined below). */
export type BookingPrice = Bill & {
  billedQuantity: number; // the quantity we really bill = max(quantity, minCharge)
  chargedKm: number; // km that cost money = max(0, distanceKm − freeKm)
};

/** A bill: the two charges, and what they mean for the farmer, the government and the provider. */
export type Bill = {
  workCharge: number;
  deliveryCharge: number;
  subsidyAmount: number; // paid by the government, not by the farmer
  totalAmount: number; // what the farmer pays
  platformFee: number; // what KrishiJontro keeps
  providerAmount: number; // what the machine provider gets
};

/**
 * The last step of every bill: from the work charge and the delivery charge, works out the
 * subsidy, what the farmer pays, the platform fee and the provider's share (whole taka).
 * calculateBookingPrice uses it, and so do the two bills of a breakdown (breakdown-rules.ts).
 * Example: work 1584, delivery 250, 20% subsidy, 3% fee
 *          -> subsidy 317, farmer pays 1517, fee 55, provider gets 1779
 */
export function billFromCharges(
  charges: { workCharge: number; deliveryCharge: number },
  subsidyPercent: number,
  platformFeePercent: number,
): Bill {
  const { workCharge, deliveryCharge } = charges;

  // The subsidy is a discount on the WORK charge only (not on delivery).
  const subsidyAmount = Math.round((workCharge * subsidyPercent) / 100);
  const totalAmount = workCharge + deliveryCharge - subsidyAmount;

  // The platform fee comes out of the provider's share; the farmer does not pay extra for it.
  const platformFee = Math.round(((workCharge + deliveryCharge) * platformFeePercent) / 100);
  const providerAmount = workCharge + deliveryCharge - platformFee;

  return { workCharge, deliveryCharge, subsidyAmount, totalAmount, platformFee, providerAmount };
}

/**
 * Works out the price of a booking (the formula is at the top of this file).
 * Used for the estimate before booking, and again at the end with the real quantity.
 *
 * Example (the project's test case): 66 decimal = 0.66 acre, rate 2400 Tk/acre,
 * 8 km with 3 free km at 50 Tk/km, 20% subsidy, 3% platform fee
 * -> work 1584, delivery 250, subsidy 317, farmer pays 1517, fee 55, provider gets 1779.
 */
export function calculateBookingPrice(input: BookingPriceInput): BookingPrice {
  // A tiny job is still billed as the minimum (e.g. 0.2 acre is billed as 0.5 acre).
  const billedQuantity = Math.max(input.quantity, input.minCharge);
  const workCharge = Math.round(billedQuantity * input.rate);

  // Only the km after the free km cost money. A field 2 km away pays no delivery.
  // Rounded to 1 decimal like the distance itself (8.3 − 3 gives 5.300000000000001 in JavaScript).
  const chargedKm = Math.round(Math.max(0, input.distanceKm - input.freeKm) * 10) / 10;
  const deliveryCharge = Math.round(chargedKm * input.deliveryRatePerKm);

  const bill = billFromCharges({ workCharge, deliveryCharge }, input.subsidyPercent, input.platformFeePercent);
  return { billedQuantity, chargedKm, ...bill };
}

// ─────────────────────────── Part 3: one job on one machine ───────────────────────────

/** A farmer's job, as the price estimate needs it. */
export type JobDetails = {
  landDecimal: number;
  hoursOrDays: number; // only used by machines rented per hour or per day
  field: LatLng;
};

/** The parts of a machine type's price rule that the price of a job needs. */
export type JobPriceRule = {
  billingUnit: BillingUnit;
  minCharge: number;
  freeKm: number;
  deliveryRatePerKm: number;
};

/** The estimate for one machine and one job. */
export type JobEstimate = {
  distanceKm: number; // machine -> field
  quantity: number; // acres, hours or days the farmer asked for
  price: BookingPrice;
};

/**
 * Estimates the price of one job on one machine:
 * the distance from the machine to the field, the billed quantity and the full price.
 */
export function estimateJob(
  machine: { rate: number; lat: number; lng: number },
  rule: JobPriceRule,
  job: JobDetails,
  subsidyPercent: number,
  platformFeePercent: number,
): JobEstimate {
  const distanceKm = distanceInKm(machine, job.field);
  const quantity = getBillingQuantity(rule.billingUnit, job.landDecimal, job.hoursOrDays);
  const price = calculateBookingPrice({
    quantity,
    rate: machine.rate,
    minCharge: rule.minCharge,
    distanceKm,
    freeKm: rule.freeKm,
    deliveryRatePerKm: rule.deliveryRatePerKm,
    subsidyPercent,
    platformFeePercent,
  });
  return { distanceKm, quantity, price };
}
