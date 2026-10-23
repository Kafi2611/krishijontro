"use server";
// Server actions for checking farmers: the farmer sends their NID and land, and the
// agriculture officer verifies or rejects them. Each one checks ON THE SERVER that the user has
// the right role, checks the form again with the same Zod rules as the browser, then calls the
// service with the user's own id.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { decideVerification, saveFarmerDetails } from "@/lib/services/verification";
import { approvalDecisionSchema, type ApprovalDecision } from "@/lib/validators/approval";
import type { ActionResult } from "@/lib/validators/types";
import { farmerDetailsSchema, type FarmerDetailsInput } from "@/lib/validators/verification";

/** After a successful change, every page is drawn again with the new status. */
function refreshPagesIfDone(result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** The farmer sends their NID, land, village and upazila for checking. */
export async function saveFarmerDetailsAction(values: FarmerDetailsInput): Promise<ActionResult> {
  const farmer = await requireRole("FARMER");
  const parsed = farmerDetailsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await saveFarmerDetails(farmer, parsed.data));
}

/** The officer verifies a farmer of their upazila, or rejects with a reason. */
export async function decideVerificationAction(farmerId: string, values: ApprovalDecision): Promise<ActionResult> {
  const officer = await requireRole("OFFICER");
  const parsed = approvalDecisionSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "reasonRequired" };
  }
  return refreshPagesIfDone(await decideVerification(farmerId, officer.id, parsed.data));
}
