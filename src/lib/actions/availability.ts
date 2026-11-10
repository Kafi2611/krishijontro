"use server";
// Server actions for the availability calendar: block days and remove a block.
// Both check on the server that the user is a PROVIDER; the service then makes
// sure the machine belongs to that provider.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { addAvailabilityBlock, removeAvailabilityBlock } from "@/lib/services/availability";
import { availabilityBlockSchema, type AvailabilityBlockInput } from "@/lib/validators/availability";
import { areIds } from "@/lib/validators/ids";
import type { ActionResult } from "@/lib/validators/types";

/** Blocks a range of days for one machine. */
export async function addAvailabilityBlockAction(
  machineId: string,
  values: AvailabilityBlockInput,
): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  if (!areIds(machineId)) {
    return { ok: false, error: "notFound" };
  }
  const parsed = availabilityBlockSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await addAvailabilityBlock(machineId, provider.id, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout"); // redraw the calendar with the new blocked days
  }
  return result;
}

/** Removes one block (the days become free again). */
export async function removeAvailabilityBlockAction(blockId: string): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  if (!areIds(blockId)) {
    return { ok: false, error: "notFound" };
  }
  const result = await removeAvailabilityBlock(blockId, provider.id);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}
