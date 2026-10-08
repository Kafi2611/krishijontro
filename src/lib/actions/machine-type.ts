"use server";
// Server actions for the admin's machine type form (add and edit).
// Each one checks on the server that the user is an ADMIN, checks the form
// again with Zod, then lets the machine type service do the work.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createMachineType, updateMachineType } from "@/lib/services/machine-type";
import { machineTypeSchema, type MachineTypeInput } from "@/lib/validators/machine-type";
import type { ActionResult } from "@/lib/validators/types";

/** Adds a new machine type. Returns ok or an error key for the form. */
export async function createMachineTypeAction(values: MachineTypeInput): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = machineTypeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await createMachineType(parsed.data, admin.id);
  if (result.ok) {
    revalidatePath("/", "layout"); // show the new type on every page that lists types
  }
  return result;
}

/** Saves changes to an existing machine type. Returns ok or an error key for the form. */
export async function updateMachineTypeAction(
  id: string,
  values: MachineTypeInput,
): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = machineTypeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await updateMachineType(id, parsed.data, admin.id);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}
