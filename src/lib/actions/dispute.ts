"use server";
// Server actions for complaints ("disputes"). Each one first checks ON THE SERVER that the user
// has the right role, checks the form again with the same Zod rules as the browser, then calls
// the dispute service with the user's own id (so nobody can act for someone else).
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { decideDispute, raiseDispute } from "@/lib/services/dispute";
import { complaintSchema, decisionSchema, type ComplaintInput, type DecisionInput } from "@/lib/validators/dispute";
import type { ActionResult } from "@/lib/validators/types";

/** After a successful change, every page is drawn again with the new status. */
function refreshPagesIfDone(result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** The farmer's "Report a problem" on one of their finished jobs. */
export async function raiseDisputeAction(bookingId: string, values: ComplaintInput): Promise<ActionResult> {
  const farmer = await requireRole("FARMER");
  const parsed = complaintSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "describeProblem" };
  }
  return refreshPagesIfDone(await raiseDispute(bookingId, farmer, parsed.data));
}

/** The admin's decision on a complaint: give money back (or lower the bill), fine, or no action. */
export async function decideDisputeAction(disputeId: string, values: DecisionInput): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = decisionSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "amountRequired" };
  }
  return refreshPagesIfDone(await decideDispute(disputeId, admin.id, parsed.data));
}
