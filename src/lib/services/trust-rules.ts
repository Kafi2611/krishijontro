/**
 * Trust rules — the provider's trust score (0 to 100). Farmers see it in the search, and at the
 * same distance the more trusted provider comes first (also for emergency replacements).
 *
 *   score = average star rating × 20  −  5 for each booking the provider cancelled in the last 90 days
 *   kept between 0 and 100.
 * The average uses every review of the provider's machines (machine AND operator stars).
 * A provider without any review starts at 80 (the same as 4 stars).
 *
 * This is a pure function (no database); trust.ts reads the numbers and saves the score.
 */

/** The score of a provider who has no reviews yet (like 4 stars). */
export const NEW_PROVIDER_TRUST = 80;

/** 5 stars × 20 = 100, the best score. */
export const POINTS_PER_STAR = 20;

/** Points taken off for each booking the provider cancelled... */
export const CANCELLATION_PENALTY = 5;

/** ...during this many days before today. */
export const CANCELLATION_WINDOW_DAYS = 90;

/**
 * Works out the trust score (see the top of this file).
 * Example: 4.5 stars and 1 cancellation -> 90 − 5 = 85; no reviews and no cancellation -> 80
 */
export function calculateTrustScore(input: { averageRating: number | null; recentCancellations: number }): number {
  const fromStars = input.averageRating === null ? NEW_PROVIDER_TRUST : Math.round(input.averageRating * POINTS_PER_STAR);
  const score = fromStars - input.recentCancellations * CANCELLATION_PENALTY;
  return Math.min(100, Math.max(0, score));
}

/** The first moment that still counts for cancellations: 90 days ago. */
export function getCancellationWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - CANCELLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}
