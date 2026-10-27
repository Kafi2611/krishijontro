"use server";
// Server actions for breakdowns: the operator reports one, a provider sends a replacement
// machine, and the admin closes the search when no machine came. Each one first checks ON THE
// SERVER that the user has the right role, checks the form again with the same Zod rules as the
// browser, then calls the service with the user's own id (so nobody can act for someone else).
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { reportBreakdown } from "@/lib/services/breakdown";
import { acceptReplacement, markNoReplacement } from "@/lib/services/replacement";
import { breakdownSchema, type BreakdownInput } from "@/lib/validators/breakdown";
import type { ActionResult } from "@/lib/validators/types";

/** After a successful step, every page is drawn again with the new status. */
function refreshPagesIfDone(result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** The operator: "The machine broke down", with the work done, the problem and a photo. */
export async function reportBreakdownAction(bookingId: string, values: BreakdownInput): Promise<ActionResult> {
  const operator = await requireRole("OPERATOR");
  const parsed = breakdownSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await reportBreakdown(bookingId, operator.id, parsed.data));
}

/** A provider sends one of their machines to finish a broken-down job. */
export async function acceptReplacementAction(reportId: string, machineId: string): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  return refreshPagesIfDone(await acceptReplacement(reportId, machineId, provider.id));
}

/** The admin: nobody sent a machine, so the search is closed. */
export async function markNoReplacementAction(reportId: string): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  return refreshPagesIfDone(await markNoReplacement(reportId, admin.id));
}
