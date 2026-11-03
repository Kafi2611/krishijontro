"use server";
// Server action for the admin's Settings page. It checks ON THE SERVER that the user is an
// ADMIN, checks the form again with the same Zod rules as the browser, then saves.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { updatePlatformSettings } from "@/lib/services/settings";
import { settingsSchema, type SettingsInput } from "@/lib/validators/settings";
import type { ActionResult } from "@/lib/validators/types";

/** Saves the platform settings (fee %, cancellation rules, breakdown search). */
export async function updateSettingsAction(values: SettingsInput): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "settingOutOfRange" };
  }

  const result = await updatePlatformSettings(admin.id, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout"); // prices and cancel boxes on every page use the new values
  }
  return result;
}
