/**
 * Machine type service — the kinds of machines (Tractor, Reaper, Irrigation Pump...).
 *
 * - The admin adds and edits types. A type is never deleted (machines point to it);
 *   instead it can be hidden with isActive = false.
 * - Providers choose a type when they add a machine; the home page lists them.
 * Every change is written to the audit log.
 */
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import type { MachineTypeInput } from "@/lib/validators/machine-type";
import type { ActionResult } from "@/lib/validators/types";

/** All machine types (also hidden ones), with how many machines each has. For the admin. */
export async function listMachineTypesWithCounts() {
  return db.machineType.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { machines: true } } },
  });
}

/** Only the types farmers can book, in display order. For the home page and machine form. */
export async function listActiveMachineTypes() {
  return db.machineType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

/** One machine type by id, or null. */
export async function getMachineType(id: string) {
  return db.machineType.findUnique({ where: { id } });
}

/** True if Prisma failed because a unique value (here: the type name) already exists. */
function isDuplicateNameError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Adds a new machine type at the end of the list.
 * Takes validated form data and the admin's id. Returns ok, or "typeNameTaken".
 */
export async function createMachineType(
  input: MachineTypeInput,
  adminId: string,
): Promise<ActionResult> {
  try {
    // A transaction: the new type and its audit row are saved together, or not at all.
    await db.$transaction(async (tx) => {
      const last = await tx.machineType.findFirst({ orderBy: { sortOrder: "desc" } });
      const machineType = await tx.machineType.create({
        data: { ...input, sortOrder: (last?.sortOrder ?? 0) + 1 },
      });
      await writeAuditLog(
        {
          actorId: adminId,
          action: "MACHINE_TYPE_CREATED",
          entityType: "MachineType",
          entityId: machineType.id,
          details: `Added machine type ${machineType.name}`,
        },
        tx,
      );
    });
    return { ok: true };
  } catch (error) {
    if (isDuplicateNameError(error)) {
      return { ok: false, error: "typeNameTaken" };
    }
    throw error;
  }
}

/**
 * Changes an existing machine type.
 * Returns ok, "notFound" (wrong id) or "typeNameTaken".
 */
export async function updateMachineType(
  id: string,
  input: MachineTypeInput,
  adminId: string,
): Promise<ActionResult> {
  const existing = await getMachineType(id);
  if (!existing) {
    return { ok: false, error: "notFound" };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.machineType.update({ where: { id }, data: input });
      await writeAuditLog(
        {
          actorId: adminId,
          action: "MACHINE_TYPE_UPDATED",
          entityType: "MachineType",
          entityId: id,
          details: `Updated machine type ${input.name}${input.isActive ? "" : " (hidden)"}`,
        },
        tx,
      );
    });
    return { ok: true };
  } catch (error) {
    if (isDuplicateNameError(error)) {
      return { ok: false, error: "typeNameTaken" };
    }
    throw error;
  }
}
