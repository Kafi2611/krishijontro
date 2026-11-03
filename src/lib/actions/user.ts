"use server";
// Server actions for the admin's Users page. Each one checks ON THE SERVER that the user is
// an ADMIN, checks the form again with the same Zod rules as the browser, then calls the
// service with the admin's own id (it is saved in the audit log).
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { changeUserStatus } from "@/lib/services/user";
import { userStatusSchema, type UserStatusInput } from "@/lib/validators/user";
import type { ActionResult } from "@/lib/validators/types";

/** Suspends an account (with a reason) or makes it active again. */
export async function changeUserStatusAction(userId: string, values: UserStatusInput): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
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
