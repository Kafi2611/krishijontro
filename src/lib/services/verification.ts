/**
 * Verification service — the agriculture officer checks a farmer's NID and land.
 *
 * 1. The farmer fills in the "NID and land" form (saveFarmerDetails). The profile becomes
 *    PENDING and the officers of the farmer's upazila get a message.
 * 2. The officer of THAT upazila checks the papers and verifies or rejects with a reason
 *    (decideVerification). Each decision writes an audit log row and tells the farmer.
 * A VERIFIED farmer can no longer change these details alone (they must ask the officer),
 * because the subsidy depends on them. A REJECTED farmer fixes them and sends them again.
 * Only a verified farmer gets a subsidy discount (see findUsableSubsidy in subsidy.ts).
 */
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import { toDecimal } from "@/lib/services/geo";
import { isUpazila } from "@/lib/services/location";
import { createNotification } from "@/lib/services/notification";
import { getOfficerUpazila, notifyUpazilaOfficers } from "@/lib/services/officer";
import { detailsSentMessage, verificationDecidedMessage } from "@/lib/services/subsidy-messages";
import type { ApprovalDecision } from "@/lib/validators/approval";
import type { ActionResult } from "@/lib/validators/types";
import type { FarmerDetailsInput } from "@/lib/validators/verification";

// ─────────────────────────── The farmer ───────────────────────────

/** The farmer's profile with their upazila, for the subsidy page. */
export async function getFarmerDetails(farmerId: string) {
  return db.farmerProfile.findUnique({
    where: { userId: farmerId },
    include: { location: { select: { name: true, nameBn: true } } },
  });
}

/**
 * The farmer sends (or sends again) their NID, land, village and upazila for checking.
 * Refused if they are already verified ("alreadyVerified").
 */
export async function saveFarmerDetails(farmer: { id: string; name: string }, input: FarmerDetailsInput): Promise<ActionResult> {
  const profile = await db.farmerProfile.findUnique({ where: { userId: farmer.id } });
  if (!profile) {
    return { ok: false, error: "notFound" };
  }
  if (profile.verificationStatus === "VERIFIED") {
    return { ok: false, error: "alreadyVerified" };
  }
  if (!(await isUpazila(input.locationId))) {
    return { ok: false, error: "somethingWrong" };
  }

  // Land is always saved in decimal; 2 places after the point is enough (e.g. 1.5 bigha = 49.5).
  const landDecimal = Math.round(toDecimal(input.landValue, input.landUnit) * 100) / 100;
  await db.$transaction(async (tx) => {
    await tx.farmerProfile.update({
      where: { userId: farmer.id },
      data: {
        nid: input.nid,
        landDecimal,
        village: input.village,
        locationId: input.locationId,
        verificationStatus: "PENDING",
        verifiedById: null,
        verifiedAt: null,
        rejectionReason: null,
      },
    });
    await notifyUpazilaOfficers(input.locationId, detailsSentMessage(farmer.name), tx);
  });
  return { ok: true };
}

// ─────────────────────────── The officer ───────────────────────────

/** The farmer fields the officer's list shows. */
const FARMER_FOR_OFFICER = {
  user: { select: { name: true, phone: true } },
} as const;

/**
 * The officer's "Verify farmers" page: farmers of the officer's upazila who sent their details
 * and wait (oldest first), and the ones checked most recently. Null if the officer has no upazila.
 */
export async function listFarmersForOfficer(officerId: string) {
  const upazila = await getOfficerUpazila(officerId);
  if (!upazila) {
    return null;
  }
  const [waiting, recent] = await Promise.all([
    db.farmerProfile.findMany({
      where: { locationId: upazila.id, verificationStatus: "PENDING", nid: { not: null } },
      include: FARMER_FOR_OFFICER,
      orderBy: { updatedAt: "asc" },
    }),
    db.farmerProfile.findMany({
      where: { locationId: upazila.id, verificationStatus: { in: ["VERIFIED", "REJECTED"] } },
      include: FARMER_FOR_OFFICER,
      orderBy: { verifiedAt: "desc" },
      take: 10,
    }),
  ]);
  return { upazila, waiting, recent };
}

/** How many farmers of the officer's upazila wait to be verified (for the dashboard). */
export async function countFarmersToVerify(officerId: string): Promise<number> {
  const upazila = await getOfficerUpazila(officerId);
  if (!upazila) {
    return 0;
  }
  return db.farmerProfile.count({
    where: { locationId: upazila.id, verificationStatus: "PENDING", nid: { not: null } },
  });
}

/**
 * The officer verifies or rejects (with a reason) a farmer of THEIR upazila.
 * In one transaction: the new status, an audit log row and a message to the farmer.
 * Only a PENDING farmer can be decided, so two officers cannot decide the same farmer twice.
 */
export async function decideVerification(
  farmerId: string,
  officerId: string,
  decision: ApprovalDecision,
): Promise<ActionResult> {
  const upazila = await getOfficerUpazila(officerId);
  const profile = await db.farmerProfile.findUnique({
    where: { userId: farmerId },
    include: { user: { select: { name: true } } },
  });
  // A farmer of another upazila is "not found" for this officer.
  if (!upazila || !profile || profile.locationId !== upazila.id) {
    return { ok: false, error: "notFound" };
  }

  const decided = await db.$transaction(async (tx) => {
    // Only a farmer who is STILL pending is changed (count 0 = another officer decided a moment ago).
    const { count } = await tx.farmerProfile.updateMany({
      where: { userId: farmerId, verificationStatus: "PENDING", nid: { not: null } },
      data: {
        verificationStatus: decision.approve ? "VERIFIED" : "REJECTED",
        verifiedById: officerId, // the officer who checked, whatever the result
        verifiedAt: new Date(),
        rejectionReason: decision.approve ? null : decision.reason,
      },
    });
    if (count === 0) {
      return false; // nothing was changed, so there is nothing to undo
    }
    await writeAuditLog(
      {
        actorId: officerId,
        action: decision.approve ? "FARMER_VERIFIED" : "FARMER_VERIFICATION_REJECTED",
        entityType: "FarmerProfile",
        entityId: profile.id,
        details: decision.approve
          ? `Verified farmer ${profile.user.name}`
          : `Did not verify farmer ${profile.user.name}: ${decision.reason}`,
      },
      tx,
    );
    await createNotification(
      { userId: farmerId, channel: "SMS", ...verificationDecidedMessage(decision.approve, decision.reason) },
      tx,
    );
    return true;
  });
  return decided ? { ok: true } : { ok: false, error: "alreadyDecided" };
}
