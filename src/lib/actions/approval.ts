"use server";
// Server action for the admin's approve / reject buttons.
// It checks on the server that the user is an ADMIN, checks the decision with Zod
// (a rejection needs a reason), then calls the approval service for the right list.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { decideMachine, decideOperator, decideProvider } from "@/lib/services/approval";
import {
  approvalDecisionSchema,
  type ApprovalDecision,
  type ApprovalTarget,
} from "@/lib/validators/approval";
import type { ActionResult } from "@/lib/validators/types";

/**
 * Approves or rejects one item.
 * target: which list ("providers", "machines" or "operators")
 * id: the provider's or operator's user id, or the machine id
 */
export async function decideApprovalAction(
  target: ApprovalTarget,
  id: string,
  values: ApprovalDecision,
): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = approvalDecisionSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "reasonRequired" };
  }

  let result: ActionResult;
  if (target === "providers") {
    result = await decideProvider(id, admin.id, parsed.data);
  } else if (target === "machines") {
    result = await decideMachine(id, admin.id, parsed.data);
  } else if (target === "operators") {
    result = await decideOperator(id, admin.id, parsed.data);
  } else {
    result = { ok: false, error: "somethingWrong" }; // an unknown list name
  }

  if (result.ok) {
    revalidatePath("/", "layout"); // the item leaves the list, the counts change
  }
  return result;
}
