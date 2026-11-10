"use server";
// Server actions for the admin's Users page: suspend / activate, and add a staff account.
// Each one checks ON THE SERVER that the user is an ADMIN, checks the form again with the
// same Zod rules as the browser, then calls the service with the admin's own id (it is
// saved in the audit log).
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createStaffUser } from "@/lib/services/staff";
import { changeUserStatus } from "@/lib/services/user";
import { areIds } from "@/lib/validators/ids";
import { staffSchema, type StaffInput } from "@/lib/validators/staff";
import { userStatusSchema, type UserStatusInput } from "@/lib/validators/user";
import type { ActionResult } from "@/lib/validators/types";

/** Suspends an account (with a reason) or makes it active again. */
export async function changeUserStatusAction(userId: string, values: UserStatusInput): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  if (!areIds(userId)) {
    return { ok: false, error: "notFound" };
  }
  const parsed = userStatusSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "reasonRequired" };
  }

  const result = await changeUserStatus(admin.id, userId, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** Makes an account for a cooperative leader, technician, officer, govt user or admin. */
export async function createStaffAction(values: StaffInput): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = staffSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await createStaffUser(admin.id, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}
