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
 * Phase 3 adds the full booking price (work + delivery − subsidy) to this file.
 *
 * Everything here is a pure function (no database), so it is easy to test
 * and can also run in the browser to warn the provider early.
 */

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
 * Returns the allowed rate range on a given day.
 * In the harvest season the maximum goes up by seasonCapPercent,
 * rounded DOWN to whole taka (so we never allow more than the cap).
 * Example: maxRate 3000, cap 10%, in season -> maxRate 3300.
 */
export function getAllowedRateRange(rule: RateLimitRule, date: Date = new Date()): RateRange {
  const inHarvestSeason = isInHarvestSeason(rule, date);
  let maxRate = rule.maxRate;
  if (inHarvestSeason) {
    maxRate = Math.floor((rule.maxRate * (100 + rule.seasonCapPercent)) / 100);
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
