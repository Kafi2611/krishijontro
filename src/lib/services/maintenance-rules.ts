/**
 * Maintenance rules — engine hours, service alerts and the steps of a repair.
 *
 * Everything here is a pure function (no database), so it is easy to test.
 *
 *   1. Engine hours: how many hours a finished job adds to the machine's engine.
 *   2. Service alerts: a machine is "ok", "soon" (fewer than SERVICE_WARNING_HOURS left) or
 *      "due". A due machine is left out of the farmer search until it is serviced.
 *   3. The repair steps a technician walks through: Received → Inspecting → Repairing → Fixed.
 */
import type { BillingUnit, MaintenanceStatus } from "@/generated/prisma/enums";
import { HOURS_PER_ACRE } from "@/lib/services/booking-rules";
import { isServiceDue } from "@/lib/services/machine-rules";

// ─────────────────────────── 1. Engine hours ───────────────────────────

/** A machine rented per day runs its engine about this many hours each day. */
export const ENGINE_HOURS_PER_DAY = 8;

/** Rounds to 1 decimal, e.g. 1.3200000001 -> 1.3 */
function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * How many hours the engine ran for a job, from the work done (in the billing unit):
 * - per hour: the hours worked
 * - per acre: HOURS_PER_ACRE (2) for each acre, the same guess the booking calendar uses
 * - per day:  ENGINE_HOURS_PER_DAY (8) for each day
 * Example: getEngineHoursUsed("PER_ACRE", 0.66) -> 1.3
 */
export function getEngineHoursUsed(billingUnit: BillingUnit, quantity: number): number {
  if (billingUnit === "PER_HOUR") {
    return roundTo1(quantity);
  }
  if (billingUnit === "PER_DAY") {
    return roundTo1(quantity * ENGINE_HOURS_PER_DAY);
  }
  return roundTo1(quantity * HOURS_PER_ACRE);
}

// ─────────────────────────── 2. Service alerts ───────────────────────────

/** After a service, the next service is due this many engine hours later. */
export const SERVICE_INTERVAL_HOURS = 250;

/** The provider is warned when fewer than this many engine hours are left before the next service. */
export const SERVICE_WARNING_HOURS = 25;

/** "ok" = nothing to do, "soon" = plan a service, "due" = must be serviced before the next job. */
export type ServiceState = "ok" | "soon" | "due";

/** The two machine fields the alerts look at. */
type EngineCounter = { engineHours: number; serviceDueHours: number };

/**
 * Engine hours left until the next service (never below 0).
 * Example: engineHours 480, serviceDueHours 500 -> 20
 */
export function getHoursUntilService(machine: EngineCounter): number {
  return Math.max(0, roundTo1(machine.serviceDueHours - machine.engineHours));
}

/**
 * The machine's service alert.
 * Example: 480 of 500 hours -> "soon" (20 left); 2010 of 2000 -> "due"; 820 of 1000 -> "ok"
 */
export function getServiceState(machine: EngineCounter): ServiceState {
  if (isServiceDue(machine)) {
    return "due";
  }
  if (getHoursUntilService(machine) < SERVICE_WARNING_HOURS) {
    return "soon";
  }
  return "ok";
}

/**
 * True if a job just moved the machine into a NEW alert ("ok" -> "soon", or into "due").
 * Then the provider gets one message; staying in the same alert sends nothing again.
 */
export function isNewServiceAlert(before: ServiceState, after: ServiceState): boolean {
  return after !== "ok" && after !== before;
}

/**
 * When a service is finished, the next one is due SERVICE_INTERVAL_HOURS later.
 * Example: serviced at 2010 engine hours -> next service at 2260
 */
export function getNextServiceDueHours(engineHours: number): number {
  return roundTo1(engineHours + SERVICE_INTERVAL_HOURS);
}

// ─────────────────────────── 3. The repair steps ───────────────────────────

/** The steps of a repair or service, in order. */
export const MAINTENANCE_STEPS: MaintenanceStatus[] = ["RECEIVED", "INSPECTING", "REPAIRING", "FIXED"];

/**
 * The step after this one, or null after the last step (FIXED).
 * Example: getNextMaintenanceStatus("INSPECTING") -> "REPAIRING"
 */
export function getNextMaintenanceStatus(status: MaintenanceStatus): MaintenanceStatus | null {
  const index = MAINTENANCE_STEPS.indexOf(status);
  return MAINTENANCE_STEPS[index + 1] ?? null;
}

/** True while the technician still has work to do on the request (any step before FIXED). */
export function isMaintenanceOpen(status: MaintenanceStatus): boolean {
  return status !== "FIXED";
}
