// Zod rules for the admin's "machine type" form (e.g. Tractor, Irrigation Pump).
// The same rules run in the browser and again on the server.
import { z } from "zod";
import { BillingUnit, MachineCategory, WorkType } from "@/generated/prisma/enums";

/**
 * The icons a machine type can use. Each is the name of a lucide-react icon,
 * drawn by components/machine-type-icon.tsx.
 */
export const MACHINE_ICON_NAMES = [
  "Tractor",
  "Shovel",
  "Wheat",
  "Scissors",
  "Sprout",
  "Droplets",
  "Leaf",
  "SprayCan",
] as const;

export type MachineIconName = (typeof MACHINE_ICON_NAMES)[number];

export const machineTypeSchema = z.object({
  name: z.string().trim().min(2, "required").max(40, "tooLong"),
  nameBn: z.string().trim().min(2, "required").max(40, "tooLong"),
  // z.enum(MachineCategory) accepts only the values of the Prisma enum, e.g. "HARVESTING"
  category: z.enum(MachineCategory, "required"),
  workTypes: z.array(z.enum(WorkType)).min(1, "workTypesRequired"),
  billingUnit: z.enum(BillingUnit, "required"),
  icon: z.enum(MACHINE_ICON_NAMES, "required"),
  isActive: z.boolean(),
});

export type MachineTypeInput = z.infer<typeof machineTypeSchema>;
