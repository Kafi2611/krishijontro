"use server";
// Server actions for the cooperative leader. Each one checks ON THE SERVER that the user is a
// COOP_LEADER, checks the form again with the same Zod rules as the browser, then calls the
// service with the leader's own id (so a leader can only change their own cooperative).
import { refreshPagesIfDone } from "@/lib/actions/refresh";
import { requireRole } from "@/lib/auth";
import { addMember, removeMember, saveCooperative } from "@/lib/services/cooperative";
import { addMemberSchema, cooperativeSchema, type AddMemberInput, type CooperativeInput } from "@/lib/validators/cooperative";
import { areIds } from "@/lib/validators/ids";
import type { ActionResult } from "@/lib/validators/types";

/** Makes the leader's cooperative, or saves its changed details. */
export async function saveCooperativeAction(values: CooperativeInput): Promise<ActionResult> {
  const leader = await requireRole("COOP_LEADER");
  const parsed = cooperativeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await saveCooperative(leader.id, parsed.data));
}

/** Adds a member farmer by their mobile number. */
export async function addMemberAction(values: AddMemberInput): Promise<ActionResult> {
  const leader = await requireRole("COOP_LEADER");
  const parsed = addMemberSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "phoneInvalid" };
  }
  return refreshPagesIfDone(await addMember(leader, parsed.data.phone));
}

/** Removes a member from the leader's cooperative. */
export async function removeMemberAction(memberId: string): Promise<ActionResult> {
  const leader = await requireRole("COOP_LEADER");
  if (!areIds(memberId)) {
    return { ok: false, error: "notFound" };
  }
  return refreshPagesIfDone(await removeMember(leader.id, memberId));
}
