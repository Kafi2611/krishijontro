/**
 * Pricing rule service — reads the government price rules from the database.
 *
 * The rules themselves (min/max rate, harvest season...) are checked by the
 * pure functions in pricing.ts. This file only finds the right rule.
 * Phase 3 adds the government page that creates and edits these rules.
 */
import { db } from "@/lib/db";
import { getAllowedRateRange, type RateRange } from "@/lib/services/pricing";

/**
 * Finds the price rule of a machine type that is in force on a date.
 * A rule is in force when activeFrom <= date and (activeTo is empty or >= date).
 * If several match, the newest one wins. Returns null if there is none.
 */
export async function getActivePricingRule(machineTypeId: string, date: Date = new Date()) {
  return db.pricingRule.findFirst({
    where: {
      machineTypeId,
      activeFrom: { lte: date },
      OR: [{ activeTo: null }, { activeTo: { gte: date } }],
    },
    orderBy: { activeFrom: "desc" },
  });
}

/**
 * Returns today's allowed rate range for EVERY machine type that has a rule,
 * as { machineTypeId: { minRate, maxRate, inHarvestSeason } }.
 * The machine form uses it to show "Allowed: 2000 – 3000 Tk" under the rate box.
 */
export async function getRateRangesByMachineType(
  date: Date = new Date(),
): Promise<Record<string, RateRange>> {
  const rules = await db.pricingRule.findMany({
    where: {
      activeFrom: { lte: date },
      OR: [{ activeTo: null }, { activeTo: { gte: date } }],
    },
    // Oldest first, so a newer rule for the same type overwrites an older one below.
    orderBy: { activeFrom: "asc" },
  });

  const ranges: Record<string, RateRange> = {};
  for (const rule of rules) {
    ranges[rule.machineTypeId] = getAllowedRateRange(rule, date);
  }
  return ranges;
}
