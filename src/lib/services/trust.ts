/**
 * Trust service — works out a provider's trust score again and saves it (ProviderProfile.trustScore).
 *
 * The formula is in trust-rules.ts: average stars × 20, minus 5 for each booking the provider
 * cancelled in the last 90 days, kept between 0 and 100. It is worked out again:
 *   - after a farmer reviews one of the provider's machines (review.ts)
 *   - after the provider cancels a booking (cancellation.ts)
 * Farmers see the score in the search, and the more trusted provider comes first at the same distance.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { calculateTrustScore, getCancellationWindowStart } from "@/lib/services/trust-rules";

/**
 * Reads the provider's reviews and recent cancellations, saves the new trust score and returns it.
 * Pass `tx` to do it inside the same transaction as the review or the cancellation.
 */
export async function refreshTrustScore(providerId: string, tx: Prisma.TransactionClient = db): Promise<number> {
  // The average of every review of the provider's machines (machine AND operator stars).
  const ratings = await tx.review.aggregate({
    where: { machine: { providerId } },
    _avg: { rating: true },
  });
  // Bookings the provider cancelled themselves: history rows "-> CANCELLED" done by the provider.
  const recentCancellations = await tx.bookingStatusLog.count({
    where: { toStatus: "CANCELLED", actorId: providerId, createdAt: { gte: getCancellationWindowStart() } },
  });

  const trustScore = calculateTrustScore({ averageRating: ratings._avg.rating, recentCancellations });
  await tx.providerProfile.update({ where: { userId: providerId }, data: { trustScore } });
  return trustScore;
}
