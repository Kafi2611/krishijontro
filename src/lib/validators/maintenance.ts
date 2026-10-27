// Zod rules for the repair and service forms. The same rules run in the browser and on the server.
//   maintenanceRequestSchema — the provider asks for a service or a repair of a machine
//   finishRepairSchema       — the technician logs the parts and the cost, and marks the machine fit
import { z } from "zod";
import { MaintenanceType } from "@/generated/prisma/enums";

/** The provider's request: what kind of work, and what is wrong (or what is due). */
export const maintenanceRequestSchema = z.object({
  type: z.enum(MaintenanceType, "required"),
  description: z.string().trim().min(5, "describeProblem").max(300, "tooLong"),
});

export type MaintenanceRequestInput = z.infer<typeof maintenanceRequestSchema>;

/** A cost in whole taka; 0 is allowed (e.g. no parts were needed). */
const costField = z.number("numberInvalid").int("wholeTaka").min(0, "numberInvalid").max(1_000_000, "numberInvalid");

/** The technician's "Fixed" form. Parts and the note may stay empty. */
export const finishRepairSchema = z.object({
  partsUsed: z.string().trim().max(300, "tooLong"), // e.g. "Fuel filter x1, engine oil 5L"
  partsCost: costField,
  labourCost: costField,
  technicianNote: z.string().trim().max(300, "tooLong"), // e.g. "Gear box bearing changed"
});

export type FinishRepairInput = z.infer<typeof finishRepairSchema>;
