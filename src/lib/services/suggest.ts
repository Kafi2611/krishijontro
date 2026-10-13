/**
 * Suggestion service — answers the farmer's question "Which machine do I need?"
 *
 * It is a simple RULE TABLE. We read it from top to bottom and use the first row
 * that matches the work and the land size:
 *
 *   Work           Land size              Suggested machine
 *   Harvesting     more than 100 decimal  Combine Harvester
 *   Harvesting     100 decimal or less    Reaper
 *   Tilling        less than 50 decimal   Power Tiller
 *   Tilling        50 decimal or more     Tractor
 *   Irrigation     any                    Irrigation Pump
 *   Transplanting  any                    Rice Transplanter
 *   Seeding        any                    Seeder
 *   Spraying       any                    Sprayer
 *
 * The answer is the machine type's English name (as the seed saves it) and a reason
 * key, which the page turns into a sentence in English or Bangla. No database here.
 */
import type { WorkType } from "@/generated/prisma/enums";

/** Above this much land, harvesting needs a combine harvester. */
export const BIG_HARVEST_DECIMAL = 100;

/** Below this much land, a power tiller is enough for tilling. */
export const SMALL_TILLING_DECIMAL = 50;

/** Why a machine was suggested. Each one is a sentence in the "Suggestion" part of messages/*.json. */
export type SuggestionReason =
  | "bigHarvest"
  | "smallHarvest"
  | "smallTilling"
  | "bigTilling"
  | "irrigation"
  | "transplanting"
  | "seeding"
  | "spraying";

export type MachineSuggestion = {
  machineTypeName: string; // e.g. "Combine Harvester"
  reason: SuggestionReason;
};

/** One row of the rule table. */
type SuggestionRule = {
  workType: WorkType;
  matchesLand: (landDecimal: number) => boolean;
  machineTypeName: string;
  reason: SuggestionReason;
};

/** Used for rows where the land size does not matter. */
const ANY_LAND = () => true;

// The rule table (same order as the table at the top of this file).
const SUGGESTION_RULES: SuggestionRule[] = [
  { workType: "HARVESTING", matchesLand: (land) => land > BIG_HARVEST_DECIMAL, machineTypeName: "Combine Harvester", reason: "bigHarvest" },
  { workType: "HARVESTING", matchesLand: ANY_LAND, machineTypeName: "Reaper", reason: "smallHarvest" },
  { workType: "TILLING", matchesLand: (land) => land < SMALL_TILLING_DECIMAL, machineTypeName: "Power Tiller", reason: "smallTilling" },
  { workType: "TILLING", matchesLand: ANY_LAND, machineTypeName: "Tractor", reason: "bigTilling" },
  { workType: "IRRIGATION", matchesLand: ANY_LAND, machineTypeName: "Irrigation Pump", reason: "irrigation" },
  { workType: "TRANSPLANTING", matchesLand: ANY_LAND, machineTypeName: "Rice Transplanter", reason: "transplanting" },
  { workType: "SEEDING", matchesLand: ANY_LAND, machineTypeName: "Seeder", reason: "seeding" },
  { workType: "SPRAYING", matchesLand: ANY_LAND, machineTypeName: "Sprayer", reason: "spraying" },
];

/**
 * Suggests one machine type for a job.
 * Example: suggestMachineType("HARVESTING", 150) -> { machineTypeName: "Combine Harvester", reason: "bigHarvest" }
 * Returns null only if no row matches (a new work type nobody wrote a rule for yet).
 */
export function suggestMachineType(workType: WorkType, landDecimal: number): MachineSuggestion | null {
  const rule = SUGGESTION_RULES.find(
    (row) => row.workType === workType && row.matchesLand(landDecimal),
  );
  if (!rule) {
    return null;
  }
  return { machineTypeName: rule.machineTypeName, reason: rule.reason };
}
