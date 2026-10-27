"use server";
// Server actions for the waitlist: the farmer joins (from the search) or leaves it.
// Each one first checks ON THE SERVER that the user is a farmer, checks the form again with the
// same Zod rules as the browser, then calls the service with the farmer's own id.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { joinWaitlist, leaveWaitlist } from "@/lib/services/waitlist";
import type { ActionResult } from "@/lib/validators/types";
import { joinWaitlistSchema, type JoinWaitlistInput } from "@/lib/validators/waitlist";

/** After a successful change, the pages are drawn again (the waitlist page shows the change). */
function refreshPagesIfDone(result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** "Join the waitlist" from a search with no free machine. */
export async function joinWaitlistAction(values: JoinWaitlistInput): Promise<ActionResult> {
  const farmer = await requireRole("FARMER");
  const parsed = joinWaitlistSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await joinWaitlist(farmer.id, parsed.data));
}

/** "Leave the list" on the waitlist page. */
export async function leaveWaitlistAction(entryId: string): Promise<ActionResult> {
  const farmer = await requireRole("FARMER");
  return refreshPagesIfDone(await leaveWaitlist(entryId, farmer.id));
}
