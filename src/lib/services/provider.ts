/**
 * Provider service — a machine provider's business profile
 * (type, business name, NID, trade licence, address, upazila, payout account).
 *
 * - A new provider starts as PENDING; the admin reads these details and approves or rejects.
 * - Farmers only see machines of APPROVED providers.
 * - If a REJECTED provider fixes and saves the details, they go back to PENDING
 *   and the admins are told, so the provider is checked again.
 * - An APPROVED provider stays approved after editing (e.g. a new payout account).
 */
import { db } from "@/lib/db";
import { isUpazila } from "@/lib/services/location";
import { notifyAllAdmins } from "@/lib/services/notification";
import type { ProviderBusinessInput } from "@/lib/validators/provider";
import type { ActionResult } from "@/lib/validators/types";

/** The provider's business profile with its upazila, or null if there is none. */
export async function getProviderProfile(userId: string) {
  return db.providerProfile.findUnique({
    where: { userId },
    include: { location: true },
  });
}

/**
 * Saves the provider's business details.
 * Returns ok, or an error key ("notFound" if the user has no provider profile).
 */
export async function updateProviderBusiness(
  userId: string,
  input: ProviderBusinessInput,
): Promise<ActionResult> {
  const profile = await db.providerProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true } } },
  });
  if (!profile) {
    return { ok: false, error: "notFound" };
  }
  if (!(await isUpazila(input.locationId))) {
    return { ok: false, error: "somethingWrong" };
  }

  const askAgain = profile.approvalStatus === "REJECTED";

  // Transaction: the new details and the admin messages are saved together.
  await db.$transaction(async (tx) => {
    await tx.providerProfile.update({
      where: { userId },
      data: {
        providerType: input.providerType,
        businessName: input.businessName,
        nid: input.nid,
        tradeLicenseNo: input.tradeLicenseNo === "" ? null : input.tradeLicenseNo,
        address: input.address,
        locationId: input.locationId,
        payoutAccount: input.payoutAccount,
        // A rejected provider who fixed the details waits for the admin again.
        ...(askAgain ? { approvalStatus: "PENDING" as const } : {}),
      },
    });
    if (askAgain) {
      await notifyAllAdmins(
        {
          title: "Provider asks for approval again",
          titleBn: "যন্ত্র মালিক আবার অনুমোদন চাইছেন",
          body: `${profile.user.name} updated the business details.`,
          bodyBn: `${profile.user.name} ব্যবসার তথ্য হালনাগাদ করেছেন।`,
          link: "/admin/approvals?tab=providers",
        },
        tx,
      );
    }
  });
  return { ok: true };
}
