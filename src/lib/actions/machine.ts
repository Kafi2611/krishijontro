"use server";
// Server actions for a provider's machines: add, edit, switch on/off, delete.
// Each one first checks ON THE SERVER that the user is a PROVIDER, and passes the
// provider's own id to the service, which only touches that provider's machines.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  createMachine,
  deleteMachine,
  setMachineActive,
  updateMachine,
  type MachineSaveResult,
} from "@/lib/services/machine";
import { machineSchema, type MachineInput } from "@/lib/validators/machine";
import type { ActionResult } from "@/lib/validators/types";

/** Adds a new machine. Returns the new machine's id, or an error key. */
export async function createMachineAction(values: MachineInput): Promise<MachineSaveResult> {
  const provider = await requireRole("PROVIDER");
  // Never trust the browser: check the form again with the same Zod rules.
  const parsed = machineSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await createMachine(provider.id, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** Saves changes to one of the provider's machines. */
export async function updateMachineAction(
  machineId: string,
  values: MachineInput,
): Promise<MachineSaveResult> {
  const provider = await requireRole("PROVIDER");
  const parsed = machineSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await updateMachine(machineId, provider.id, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** Switches a machine between "renting" (ACTIVE) and "not renting" (INACTIVE). */
export async function setMachineActiveAction(
  machineId: string,
  makeActive: boolean,
): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  const result = await setMachineActive(machineId, provider.id, makeActive);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** Deletes a machine that has no bookings or repair history. */
export async function deleteMachineAction(machineId: string): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  const result = await deleteMachine(machineId, provider.id);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}
