/**
 * Machine service — a provider's own machines (add, read, edit, switch on/off, delete).
 *
 * Safety: every function takes the provider's id and only touches machines that
 * belong to THAT provider (where: { id, providerId }). So even if someone changes
 * the machine id in the URL, they can never see or change another provider's machine.
 *
 * Rules used here:
 * - The rate must be inside today's government limit for the machine type (pricing.ts).
 * - A new machine waits for the admin (approvalStatus = PENDING); the admins get a message.
 * - After an edit, needsNewApproval() (machine-rules.ts) decides if the admin must check again.
 * - A machine with bookings or repair history is never deleted (we would lose that history);
 *   the provider can switch it to "Not renting" (INACTIVE) instead.
 */
import { db } from "@/lib/db";
import { isUniqueConstraintError } from "@/lib/db-errors";
import { isUpazila, listUpazilaOptions } from "@/lib/services/location";
import { canToggleActive, needsNewApproval } from "@/lib/services/machine-rules";
import { getMachineType, listActiveMachineTypes } from "@/lib/services/machine-type";
import { notifyAllAdmins } from "@/lib/services/notification";
import { getAllowedRateRange, isRateAllowed } from "@/lib/services/pricing";
import { getActivePricingRule, getRateRangesByMachineType } from "@/lib/services/pricing-rule";
import type { MachineInput } from "@/lib/validators/machine";
import type { ActionResult, ValidationKey } from "@/lib/validators/types";

export type MachineSaveResult = { ok: true; machineId: string } | { ok: false; error: ValidationKey };

// ─────────────────────────── Reading ───────────────────────────

/** All machines of one provider, newest first, with type, upazila and the first photo. */
export async function listProviderMachines(providerId: string) {
  return db.machine.findMany({
    where: { providerId },
    include: {
      machineType: true,
      location: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * One machine of this provider with all its details, or null if it does not
 * exist OR belongs to someone else.
 */
export async function getProviderMachine(machineId: string, providerId: string) {
  return db.machine.findFirst({
    where: { id: machineId, providerId },
    include: {
      machineType: true,
      location: { include: { parent: true } }, // upazila + its district
      images: { orderBy: { sortOrder: "asc" } },
      _count: { select: { bookings: true } },
    },
  });
}

/** How many machines a provider has, split by approval status. For the provider dashboard. */
export async function countProviderMachines(providerId: string) {
  const [total, approved, pending, rejected] = await Promise.all([
    db.machine.count({ where: { providerId } }),
    db.machine.count({ where: { providerId, approvalStatus: "APPROVED" } }),
    db.machine.count({ where: { providerId, approvalStatus: "PENDING" } }),
    db.machine.count({ where: { providerId, approvalStatus: "REJECTED" } }),
  ]);
  return { total, approved, pending, rejected };
}

/**
 * Everything the machine form needs to show its choices:
 * the machine types, today's government rate limit for each type, and the upazilas.
 */
export async function getMachineFormChoices() {
  const [machineTypes, rateRanges, upazilas] = await Promise.all([
    listActiveMachineTypes(),
    getRateRangesByMachineType(),
    listUpazilaOptions(),
  ]);
  return {
    machineTypes: machineTypes.map((type) => ({
      id: type.id,
      name: type.name,
      nameBn: type.nameBn,
      icon: type.icon,
      billingUnit: type.billingUnit,
    })),
    rateRanges,
    upazilas,
  };
}

// ─────────────────────────── Checks ───────────────────────────

/**
 * Checks the rate against TODAY's government limit for the machine type.
 * Returns an error key ("noPriceRule" or "rateOutOfRange"), or null if the rate is fine.
 */
async function checkMachineRate(machineTypeId: string, rate: number): Promise<ValidationKey | null> {
  const rule = await getActivePricingRule(machineTypeId);
  if (!rule) {
    return "noPriceRule";
  }
  const range = getAllowedRateRange(rule);
  if (!isRateAllowed(rate, range)) {
    return "rateOutOfRange";
  }
  return null;
}

/**
 * Checks the parts of the form that Zod cannot check alone, because they need the
 * database: the machine type exists and is active, the place is an upazila, the rate is allowed.
 */
async function checkMachineInput(input: MachineInput): Promise<ValidationKey | null> {
  const machineType = await getMachineType(input.machineTypeId);
  if (!machineType || !machineType.isActive) {
    return "somethingWrong";
  }
  if (!(await isUpazila(input.locationId))) {
    return "somethingWrong";
  }
  return checkMachineRate(input.machineTypeId, input.rate);
}

/** Turns form values into Machine table columns (an empty text box becomes null). */
function toMachineData(input: MachineInput) {
  return {
    machineTypeId: input.machineTypeId,
    brand: input.brand,
    model: input.model,
    year: input.year,
    horsePower: input.horsePower ?? null,
    registrationNo: input.registrationNo === "" ? null : input.registrationNo,
    description: input.description === "" ? null : input.description,
    rate: input.rate,
    locationId: input.locationId,
    address: input.address === "" ? null : input.address,
    lat: input.lat,
    lng: input.lng,
    engineHours: input.engineHours,
    serviceDueHours: input.serviceDueHours,
  };
}

/** Turns the list of photo addresses into MachineImage rows, keeping their order. */
function toImageRows(imageUrls: string[]) {
  return imageUrls.map((url, index) => ({ url, sortOrder: index }));
}

/** The message every admin gets when a machine needs to be checked. */
function machineToApproveMessage(machineName: string) {
  return {
    title: "Machine waiting for approval",
    titleBn: "যন্ত্র অনুমোদনের অপেক্ষায়",
    body: `${machineName} needs to be checked.`,
    bodyBn: `${machineName} যাচাই করা দরকার।`,
    link: "/admin/approvals?tab=machines",
  };
}

// ─────────────────────────── Changing ───────────────────────────

/**
 * Adds a new machine (with its photos) for a provider. It starts as PENDING.
 * Returns the new machine's id, or an error key for the form.
 */
export async function createMachine(providerId: string, input: MachineInput): Promise<MachineSaveResult> {
  const problem = await checkMachineInput(input);
  if (problem) {
    return { ok: false, error: problem };
  }

  try {
    // Transaction: the machine, its photos and the admin messages are saved together.
    const machine = await db.$transaction(async (tx) => {
      const created = await tx.machine.create({
        data: {
          ...toMachineData(input),
          providerId,
          approvalStatus: "PENDING",
          images: { create: toImageRows(input.imageUrls) },
        },
      });
      await notifyAllAdmins(machineToApproveMessage(`${input.brand} ${input.model}`), tx);
      return created;
    });
    return { ok: true, machineId: machine.id };
  } catch (error) {
    // Machine.registrationNo is @unique: two machines cannot have the same number.
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "registrationTaken" };
    }
    throw error;
  }
}

/**
 * Saves changes to one of the provider's machines, including its photo list.
 * If needsNewApproval() says so, the machine goes back to PENDING for the admin.
 */
export async function updateMachine(
  machineId: string,
  providerId: string,
  input: MachineInput,
): Promise<MachineSaveResult> {
  const existing = await db.machine.findFirst({ where: { id: machineId, providerId } });
  if (!existing) {
    return { ok: false, error: "notFound" };
  }
  const problem = await checkMachineInput(input);
  if (problem) {
    return { ok: false, error: problem };
  }

  const data = toMachineData(input);
  const sendForApproval = needsNewApproval(existing, data);

  try {
    await db.$transaction(async (tx) => {
      await tx.machine.update({
        where: { id: machineId },
        data: sendForApproval ? { ...data, approvalStatus: "PENDING", rejectionReason: null } : data,
      });
      // Replace the photo list: remove the old rows, then add the new list in its new order.
      await tx.machineImage.deleteMany({ where: { machineId } });
      await tx.machineImage.createMany({
        data: toImageRows(input.imageUrls).map((image) => ({ ...image, machineId })),
      });
      if (sendForApproval) {
        await notifyAllAdmins(machineToApproveMessage(`${input.brand} ${input.model}`), tx);
      }
    });
    return { ok: true, machineId };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "registrationTaken" };
    }
    throw error;
  }
}

/**
 * Switches a machine between ACTIVE (farmers can book it) and INACTIVE (not renting).
 * Not allowed while the machine is UNDER_MAINTENANCE.
 */
export async function setMachineActive(
  machineId: string,
  providerId: string,
  makeActive: boolean,
): Promise<ActionResult> {
  const machine = await db.machine.findFirst({ where: { id: machineId, providerId } });
  if (!machine) {
    return { ok: false, error: "notFound" };
  }
  if (!canToggleActive(machine.status)) {
    return { ok: false, error: "machineUnderRepair" };
  }

  await db.machine.update({
    where: { id: machineId },
    data: { status: makeActive ? "ACTIVE" : "INACTIVE" },
  });
  return { ok: true };
}

/**
 * Deletes a machine that has no history (no bookings, group bookings or repairs).
 * Its photos and blocked days are deleted with it (onDelete: Cascade in the schema).
 */
export async function deleteMachine(machineId: string, providerId: string): Promise<ActionResult> {
  const machine = await db.machine.findFirst({
    where: { id: machineId, providerId },
    include: {
      _count: { select: { bookings: true, groupBookings: true, maintenanceRequests: true } },
    },
  });
  if (!machine) {
    return { ok: false, error: "notFound" };
  }

  const { bookings, groupBookings, maintenanceRequests } = machine._count;
  if (bookings + groupBookings + maintenanceRequests > 0) {
    return { ok: false, error: "machineHasHistory" };
  }

  await db.machine.delete({ where: { id: machineId } });
  return { ok: true };
}
