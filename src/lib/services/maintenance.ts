/**
 * Maintenance service — engine hours, service alerts, and the technician's repair and service work.
 *
 * 1. Engine hours: every finished job (and the work done before a breakdown) adds hours to the
 *    machine's engine (addEngineHours). When the machine gets close to its next service, or
 *    reaches it, the provider gets ONE message. A machine whose service is due cannot be booked.
 * 2. Requests: the provider asks for a SERVICE or a REPAIR (requestMaintenance). A breakdown
 *    makes a REPAIR request by itself (createBreakdownRepair, called by breakdown.ts).
 *    Every technician is told; the first one to press "Take this job" gets it.
 * 3. The technician's steps: Received → Inspecting → Repairing → Fixed (maintenance-rules.ts).
 *    "Fixed" logs the parts and the cost and makes the machine fit for work again (makeMachineFit):
 *    - after a SERVICE, the next service is due 250 engine hours later
 *    - a machine UNDER_MAINTENANCE becomes ACTIVE again (when no other repair of it is still
 *      open), and the first farmer waiting for that kind of machine is told (waitlist.ts)
 * 4. Reading: the technician's lists, one request, a machine's service history, the alerts.
 *
 * Every step that changes a request uses updateMany with the step we expect in "where": if
 * someone else changed it a moment ago, nothing matches (count 0) and we answer with an error.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { MaintenanceStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { toDhakaDay } from "@/lib/services/calendar";
import {
  machineFitMessage,
  maintenanceStepMessage,
  newMaintenanceRequestMessage,
  serviceAlertMessage,
} from "@/lib/services/maintenance-messages";
import {
  getHoursUntilService,
  getNextMaintenanceStatus,
  getNextServiceDueHours,
  getServiceState,
  isNewServiceAlert,
} from "@/lib/services/maintenance-rules";
import { createNotification, notifyRole } from "@/lib/services/notification";
import { notifyWaitlist } from "@/lib/services/waitlist";
import type { FinishRepairInput, MaintenanceRequestInput } from "@/lib/validators/maintenance";
import type { ActionResult } from "@/lib/validators/types";

/** "Mahindra 575 DI" from a machine's brand and model. */
function machineName(machine: { brand: string; model: string }): string {
  return `${machine.brand} ${machine.model}`;
}

// ─────────────────────────── 1. Engine hours ───────────────────────────

/**
 * Adds the hours of a job to the machine's engine counter (inside the caller's transaction).
 * If this moves the machine into a new service alert ("soon" or "due"), the provider is told once.
 */
export async function addEngineHours(tx: Prisma.TransactionClient, machineId: string, hours: number): Promise<void> {
  if (hours <= 0) {
    return;
  }
  const before = await tx.machine.findUniqueOrThrow({ where: { id: machineId } });
  // "increment" adds in the database itself, so two jobs finishing at once both count.
  const after = await tx.machine.update({ where: { id: machineId }, data: { engineHours: { increment: hours } } });

  const stateBefore = getServiceState(before);
  const stateAfter = getServiceState(after);
  if (isNewServiceAlert(stateBefore, stateAfter)) {
    const machine = { id: after.id, name: machineName(after) };
    await createNotification(
      { userId: after.providerId, ...serviceAlertMessage(machine, stateAfter, getHoursUntilService(after)) },
      tx,
    );
  }
}

// ─────────────────────────── 2. Requests ───────────────────────────

/** Saves a new request and tells every technician. Returns the request's id. */
async function createRequest(
  tx: Prisma.TransactionClient,
  data: Prisma.MaintenanceRequestUncheckedCreateInput,
  machine: { brand: string; model: string },
): Promise<string> {
  const request = await tx.maintenanceRequest.create({ data });
  await notifyRole("TECHNICIAN", newMaintenanceRequestMessage(request, machineName(machine)), tx);
  return request.id;
}

/**
 * The provider asks a technician to service or repair one of THEIR machines.
 * Refused if the same kind of request for this machine is still open.
 */
export async function requestMaintenance(
  providerId: string,
  machineId: string,
  input: MaintenanceRequestInput,
): Promise<ActionResult> {
  const machine = await db.machine.findFirst({ where: { id: machineId, providerId } });
  if (!machine) {
    return { ok: false, error: "notFound" };
  }
  const openOfSameType = await db.maintenanceRequest.count({
    where: { machineId, type: input.type, status: { not: "FIXED" } },
  });
  if (openOfSameType > 0) {
    return { ok: false, error: "alreadyRequested" };
  }

  await db.$transaction((tx) =>
    createRequest(tx, { machineId, requestedById: providerId, type: input.type, description: input.description }, machine),
  );
  return { ok: true };
}

/**
 * A breakdown asks for a repair by itself (called by breakdown.ts, inside its transaction).
 * It is requested in the provider's name, because it is their machine.
 */
export async function createBreakdownRepair(
  tx: Prisma.TransactionClient,
  breakdown: { id: string; description: string },
  machine: { id: string; brand: string; model: string; providerId: string },
): Promise<void> {
  await createRequest(
    tx,
    {
      machineId: machine.id,
      requestedById: machine.providerId,
      breakdownReportId: breakdown.id,
      type: "REPAIR",
      description: breakdown.description,
    },
    machine,
  );
}

// ─────────────────────────── 3. The technician's steps ───────────────────────────

/** A request with the machine fields the steps need. */
const REQUEST_WITH_MACHINE = {
  machine: { select: { id: true, brand: true, model: true, providerId: true } },
} satisfies Prisma.MaintenanceRequestInclude;

/** Tells the provider that their request moved to `status`. */
async function tellProvider(
  tx: Prisma.TransactionClient,
  request: Prisma.MaintenanceRequestGetPayload<{ include: typeof REQUEST_WITH_MACHINE }>,
  status: MaintenanceStatus,
  technicianName: string,
): Promise<void> {
  const machine = { id: request.machine.id, name: machineName(request.machine) };
  await createNotification(
    { userId: request.machine.providerId, ...maintenanceStepMessage(machine, status, technicianName) },
    tx,
  );
}

/**
 * The technician takes a new request ("Take this job"). Only a request nobody has taken yet:
 * if two technicians press at the same moment, the second one gets "alreadyTaken".
 */
export async function takeRequest(requestId: string, technician: { id: string; name: string }): Promise<ActionResult> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.maintenanceRequest.updateMany({
      where: { id: requestId, technicianId: null, status: "RECEIVED" },
      data: { technicianId: technician.id },
    });
    if (count === 0) {
      return { ok: false, error: "alreadyTaken" } as const;
    }
    const request = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id: requestId }, include: REQUEST_WITH_MACHINE });
    await tellProvider(tx, request, "RECEIVED", technician.name);
    return { ok: true } as const;
  });
}

/**
 * The technician moves THEIR request one step on: Received -> Inspecting, or Inspecting -> Repairing.
 * (Repairing -> Fixed needs the parts and the cost, see finishRequest.)
 */
export async function advanceRequest(requestId: string, technician: { id: string; name: string }): Promise<ActionResult> {
  const request = await db.maintenanceRequest.findFirst({ where: { id: requestId, technicianId: technician.id } });
  if (!request) {
    return { ok: false, error: "notFound" };
  }
  const nextStatus = getNextMaintenanceStatus(request.status);
  if (nextStatus !== "INSPECTING" && nextStatus !== "REPAIRING") {
    return { ok: false, error: "wrongRepairStep" };
  }

  return db.$transaction(async (tx) => {
    const { count } = await tx.maintenanceRequest.updateMany({
      where: { id: requestId, technicianId: technician.id, status: request.status },
      data: { status: nextStatus },
    });
    if (count === 0) {
      return { ok: false, error: "wrongRepairStep" } as const;
    }
    const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id: requestId }, include: REQUEST_WITH_MACHINE });
    await tellProvider(tx, updated, nextStatus, technician.name);
    return { ok: true } as const;
  });
}

/**
 * The machine is fit for work again (inside the "Fixed" transaction):
 * - after a SERVICE, the next service is due 250 engine hours from now
 * - a machine UNDER_MAINTENANCE becomes ACTIVE, unless another repair of it is still open;
 *   then the first farmer waiting for this kind of machine near it is told
 */
async function makeMachineFit(
  tx: Prisma.TransactionClient,
  request: { id: string; type: "SERVICE" | "REPAIR"; machineId: string },
): Promise<void> {
  const machine = await tx.machine.findUniqueOrThrow({ where: { id: request.machineId } });
  const data: Prisma.MachineUpdateInput = {};
  if (request.type === "SERVICE") {
    data.serviceDueHours = getNextServiceDueHours(machine.engineHours);
  }

  let becameActive = false;
  if (machine.status === "UNDER_MAINTENANCE") {
    const otherOpenRepairs = await tx.maintenanceRequest.count({
      where: { machineId: machine.id, id: { not: request.id }, type: "REPAIR", status: { not: "FIXED" } },
    });
    if (otherOpenRepairs === 0) {
      data.status = "ACTIVE";
      becameActive = true;
    }
  }
  await tx.machine.update({ where: { id: machine.id }, data });

  if (becameActive) {
    const today = toDhakaDay(new Date());
    await notifyWaitlist(tx, { machineTypeId: machine.machineTypeId, lat: machine.lat, lng: machine.lng, fromDay: today, toDay: null });
  }
}

/**
 * The technician finishes THEIR request (Repairing -> Fixed): logs the parts and the cost, makes
 * the machine fit for work (makeMachineFit) and tells the provider. All in one transaction.
 */
export async function finishRequest(
  requestId: string,
  technician: { id: string; name: string },
  input: FinishRepairInput,
): Promise<ActionResult> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.maintenanceRequest.updateMany({
      where: { id: requestId, technicianId: technician.id, status: "REPAIRING" },
      data: {
        status: "FIXED",
        partsUsed: input.partsUsed === "" ? null : input.partsUsed,
        partsCost: input.partsCost,
        labourCost: input.labourCost,
        technicianNote: input.technicianNote === "" ? null : input.technicianNote,
        fixedAt: new Date(),
      },
    });
    if (count === 0) {
      return { ok: false, error: "wrongRepairStep" } as const;
    }

    const request = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id: requestId }, include: REQUEST_WITH_MACHINE });
    await makeMachineFit(tx, request);
    const machine = { id: request.machine.id, name: machineName(request.machine) };
    await createNotification(
      { userId: request.machine.providerId, ...machineFitMessage(machine, input.partsCost + input.labourCost) },
      tx,
    );
    return { ok: true } as const;
  });
}

// ─────────────────────────── 4. Reading ───────────────────────────

/** The machine fields every request card shows. */
const MACHINE_FOR_REQUEST = {
  select: {
    id: true,
    brand: true,
    model: true,
    engineHours: true,
    serviceDueHours: true,
    machineType: { select: { name: true, nameBn: true, icon: true } },
    location: { select: { name: true, nameBn: true } },
    provider: { select: { name: true, phone: true, providerProfile: { select: { businessName: true } } } },
  },
} satisfies Prisma.MachineDefaultArgs;

/** How many finished jobs the technician's "Done" list shows. */
const DONE_TO_SHOW = 20;

/**
 * The technician's lists: new requests nobody has taken yet (oldest first, they waited longest),
 * the technician's own open jobs, and their latest finished jobs.
 */
export async function listTechnicianRequests(technicianId: string) {
  const [newRequests, mine, done] = await Promise.all([
    db.maintenanceRequest.findMany({
      where: { technicianId: null, status: "RECEIVED" },
      include: { machine: MACHINE_FOR_REQUEST },
      orderBy: { createdAt: "asc" },
    }),
    db.maintenanceRequest.findMany({
      where: { technicianId, status: { not: "FIXED" } },
      include: { machine: MACHINE_FOR_REQUEST },
      orderBy: { createdAt: "asc" },
    }),
    db.maintenanceRequest.findMany({
      where: { technicianId, status: "FIXED" },
      include: { machine: MACHINE_FOR_REQUEST },
      orderBy: { fixedAt: "desc" },
      take: DONE_TO_SHOW,
    }),
  ]);
  return { newRequests, mine, done };
}

/** Counts for the technician's dashboard. */
export async function countTechnicianWork(technicianId: string) {
  const [newRequests, myOpen, fixed] = await Promise.all([
    db.maintenanceRequest.count({ where: { technicianId: null, status: "RECEIVED" } }),
    db.maintenanceRequest.count({ where: { technicianId, status: { not: "FIXED" } } }),
    db.maintenanceRequest.count({ where: { technicianId, status: "FIXED" } }),
  ]);
  return { newRequests, myOpen, fixed };
}

/**
 * One request for the technician's page: a new one nobody has taken, or one of THEIR OWN
 * (null for a request another technician took). With the breakdown it came from (if any)
 * and the machine's earlier finished work (its service history).
 */
export async function getTechnicianRequest(requestId: string, technicianId: string) {
  const request = await db.maintenanceRequest.findFirst({
    where: { id: requestId, OR: [{ technicianId: null }, { technicianId }] },
    include: {
      machine: MACHINE_FOR_REQUEST,
      breakdownReport: { include: { booking: { select: { code: true, billingUnit: true } } } },
    },
  });
  if (!request) {
    return null;
  }
  const history = await listMachineMaintenance(request.machineId, request.id);
  return { request, history };
}

/**
 * A machine's service history, newest first, with the technician's name.
 * `exceptId` leaves one request out (the one being looked at).
 */
export async function listMachineMaintenance(machineId: string, exceptId?: string) {
  return db.maintenanceRequest.findMany({
    where: { machineId, id: exceptId ? { not: exceptId } : undefined },
    include: { technician: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * The provider's machines that need a service soon, or now (getServiceState in maintenance-rules.ts),
 * with the hours left. For the provider's dashboard and machine list.
 */
export async function listProviderServiceAlerts(providerId: string) {
  const machines = await db.machine.findMany({
    where: { providerId, status: { not: "INACTIVE" } },
    select: { id: true, brand: true, model: true, engineHours: true, serviceDueHours: true },
  });
  const alerts = [];
  for (const machine of machines) {
    const state = getServiceState(machine);
    if (state !== "ok") {
      alerts.push({ ...machine, state, hoursLeft: getHoursUntilService(machine) });
    }
  }
  return alerts;
}
