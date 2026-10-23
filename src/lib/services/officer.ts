/**
 * Officer service — small helpers about agriculture officers.
 *
 * Every officer works in exactly ONE upazila (OfficerProfile.upazilaId). They only see and
 * decide the farmers (and subsidy applications) of that upazila. A farmer's upazila is
 * FarmerProfile.locationId, chosen on the farmer's "NID and land" form.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { NewNotification } from "@/lib/services/notification";

/** The officer's upazila (id and names), or null if the officer has no profile. */
export async function getOfficerUpazila(officerId: string) {
  const profile = await db.officerProfile.findUnique({
    where: { userId: officerId },
    select: { upazila: { select: { id: true, name: true, nameBn: true } } },
  });
  return profile?.upazila ?? null;
}

/**
 * Sends the same message to every active officer of one upazila,
 * e.g. "A farmer sent their NID and land". Pass `tx` to save it inside a transaction.
 */
export async function notifyUpazilaOfficers(
  upazilaId: string,
  notification: Omit<NewNotification, "userId">,
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  const officers = await tx.user.findMany({
    where: { role: "OFFICER", status: "ACTIVE", officerProfile: { upazilaId } },
    select: { id: true },
  });
  await tx.notification.createMany({
    data: officers.map((officer) => ({ ...notification, userId: officer.id })),
  });
}
