"use server";
// Server actions for repairs and services: the provider asks for one, the technician takes it
// and moves it through its steps. Each one first checks ON THE SERVER that the user has the
// right role, checks the form again with the same Zod rules as the browser, then calls the
// service with the user's own id (so nobody can act for someone else).
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { advanceRequest, finishRequest, requestMaintenance, takeRequest } from "@/lib/services/maintenance";
import {
  finishRepairSchema,
  maintenanceRequestSchema,
  type FinishRepairInput,
  type MaintenanceRequestInput,
} from "@/lib/validators/maintenance";
import type { ActionResult } from "@/lib/validators/types";

/** After a successful step, every page is drawn again with the new status. */
function refreshPagesIfDone(result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** The provider asks for a service or a repair of one of their machines. */
export async function requestMaintenanceAction(machineId: string, values: MaintenanceRequestInput): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  const parsed = maintenanceRequestSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await requestMaintenance(provider.id, machineId, parsed.data));
}

/** The technician takes a new request ("Take this job"). */
export async function takeRequestAction(requestId: string): Promise<ActionResult> {
  const technician = await requireRole("TECHNICIAN");
  return refreshPagesIfDone(await takeRequest(requestId, technician));
}

/** The technician moves their request one step on (Inspecting, then Repairing). */
export async function advanceRequestAction(requestId: string): Promise<ActionResult> {
  const technician = await requireRole("TECHNICIAN");
  return refreshPagesIfDone(await advanceRequest(requestId, technician));
}

/** The technician logs the parts and the cost, and marks the machine fit for work. */
export async function finishRequestAction(requestId: string, values: FinishRepairInput): Promise<ActionResult> {
  const technician = await requireRole("TECHNICIAN");
  const parsed = finishRepairSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await finishRequest(requestId, technician, parsed.data));
}
