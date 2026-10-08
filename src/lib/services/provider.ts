/**
 * Provider service — a machine provider's business profile
 * (business name, NID, trade licence, address, payout account, approval status).
 *
 * A new provider starts as PENDING. Farmers only see machines of APPROVED providers.
 */
import { db } from "@/lib/db";

/** The provider's business profile with its upazila, or null if there is none. */
export async function getProviderProfile(userId: string) {
  return db.providerProfile.findUnique({
    where: { userId },
    include: { location: true },
  });
}
