/**
 * Pricing rule service — the government's price limits for each machine type.
 *
 * - Reading: finds the rule in force on a date. The machine form, the search and
 *   the price calculator use it. The pure checks live in pricing.ts.
 * - Changing (the govt "Price limits" page): a rule is never overwritten.
 *   Saving new limits CLOSES the old rule (activeTo = now) and STARTS a new one
 *   (activeFrom = now), so we always know which limit applied on any past day.
 * - After a change, every provider whose machine rate is now outside the limit gets a
 *   message. Farmers do not find such a machine in search until the provider fixes the rate.
 * Every change is written to the audit log.
 */
import type { BillingUnit, WorkType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { toBanglaDigits } from "@/lib/i18n";
import { writeAuditLog } from "@/lib/services/audit";
import { endOfDhakaDay, startOfDhakaDay } from "@/lib/services/calendar";
import { getMachineType, listActiveMachineTypes } from "@/lib/services/machine-type";
import { createNotification } from "@/lib/services/notification";
import { getAllowedRateRange, isRateAllowed, type RateRange } from "@/lib/services/pricing";
import type { PricingRuleInput } from "@/lib/validators/pricing-rule";
import type { ValidationKey } from "@/lib/validators/types";

/** A machine type farmers can book, with today's price rule: all that is needed to estimate a price. */
export type PricedMachineType = {
  id: string;
  name: string;
  nameBn: string;
  icon: string;
  workTypes: WorkType[];
  billingUnit: BillingUnit;
  minRate: number; // today's allowed range (the max is higher in the harvest season)
  maxRate: number;
  freeKm: number;
  deliveryRatePerKm: number;
  minCharge: number;
};

export type PricingRuleSaveResult =
  | { ok: true; machinesOutside: number }
  | { ok: false; error: ValidationKey };

/**
 * The database condition "rules in force on this date":
 * activeFrom <= date AND (activeTo is empty OR activeTo >= date).
 */
function inForceOn(date: Date) {
  return {
    activeFrom: { lte: date },
    OR: [{ activeTo: null }, { activeTo: { gte: date } }],
  };
}

// ─────────────────────────── Reading ───────────────────────────

/**
 * Finds the price rule of a machine type that is in force on a date.
 * If several match, the newest one wins. Returns null if there is none.
 */
export async function getActivePricingRule(machineTypeId: string, date: Date = new Date()) {
  return db.pricingRule.findFirst({
    where: { machineTypeId, ...inForceOn(date) },
    orderBy: { activeFrom: "desc" },
  });
}

/**
 * All rules in force on a date, as a Map: machineTypeId -> rule.
 * If a type has two rules in force, the newer one is kept.
 */
export async function getActivePricingRulesByType(date: Date = new Date()) {
  const rules = await db.pricingRule.findMany({
    where: inForceOn(date),
    // Oldest first, so a newer rule for the same type overwrites an older one below.
    orderBy: { activeFrom: "asc" },
  });

  const ruleByType = new Map<string, (typeof rules)[number]>();
  for (const rule of rules) {
    ruleByType.set(rule.machineTypeId, rule);
  }
  return ruleByType;
}

/**
 * Returns today's allowed rate range for EVERY machine type that has a rule,
 * as { machineTypeId: { minRate, maxRate, inHarvestSeason } }.
 * The machine form uses it to show "Allowed: 2000 – 3000 Tk" under the rate box.
 */
export async function getRateRangesByMachineType(
  date: Date = new Date(),
): Promise<Record<string, RateRange>> {
  const ruleByType = await getActivePricingRulesByType(date);
  const ranges: Record<string, RateRange> = {};
  for (const [machineTypeId, rule] of ruleByType) {
    ranges[machineTypeId] = getAllowedRateRange(rule, date);
  }
  return ranges;
}

/**
 * The machine types farmers can book (active, with a price rule today), in display order.
 * Used by the price calculator and the machine search.
 */
export async function listPricedMachineTypes(date: Date = new Date()): Promise<PricedMachineType[]> {
  const [machineTypes, ruleByType] = await Promise.all([
    listActiveMachineTypes(),
    getActivePricingRulesByType(date),
  ]);

  const priced: PricedMachineType[] = [];
  for (const machineType of machineTypes) {
    const rule = ruleByType.get(machineType.id);
    if (!rule) {
      continue; // no price limit yet: nobody can rent this type
    }
    const range = getAllowedRateRange(rule, date);
    priced.push({
      id: machineType.id,
      name: machineType.name,
      nameBn: machineType.nameBn,
      icon: machineType.icon,
      workTypes: machineType.workTypes,
      billingUnit: machineType.billingUnit,
      minRate: range.minRate,
      maxRate: range.maxRate,
      freeKm: rule.freeKm,
      deliveryRatePerKm: rule.deliveryRatePerKm,
      minCharge: rule.minCharge,
    });
  }
  return priced;
}

/** Every machine type (hidden ones too) with the rule in force today, or null. For the govt page. */
export async function listMachineTypesWithRules() {
  const [machineTypes, ruleByType] = await Promise.all([
    db.machineType.findMany({ orderBy: { sortOrder: "asc" } }),
    getActivePricingRulesByType(),
  ]);
  return machineTypes.map((machineType) => ({
    machineType,
    rule: ruleByType.get(machineType.id) ?? null,
  }));
}

/**
 * One machine type with its rule in force today and up to 5 older rules (newest first),
 * for the govt "edit price limit" page. Returns null for a wrong id.
 */
export async function getMachineTypePricing(machineTypeId: string) {
  const machineType = await getMachineType(machineTypeId);
  if (!machineType) {
    return null;
  }
  const [currentRule, latestRules] = await Promise.all([
    getActivePricingRule(machineTypeId),
    db.pricingRule.findMany({ where: { machineTypeId }, orderBy: { activeFrom: "desc" }, take: 6 }),
  ]);
  const pastRules = latestRules.filter((rule) => rule.id !== currentRule?.id).slice(0, 5);
  return { machineType, currentRule, pastRules };
}

/**
 * Checks one machine's rate against TODAY's limit for its type.
 * Returns the range (to show it) and whether the rate is inside. range = null means no rule.
 */
export async function checkRateAgainstLimit(machineTypeId: string, rate: number) {
  const rule = await getActivePricingRule(machineTypeId);
  if (!rule) {
    return { range: null, isInside: false };
  }
  const range = getAllowedRateRange(rule);
  return { range, isInside: isRateAllowed(rate, range) };
}

/**
 * How many machines (not rejected) have a rate outside today's limit of their type.
 * Machines of a type without any rule are counted too. For the govt dashboard.
 */
export async function countMachinesOutsideLimits(): Promise<number> {
  const [ranges, machines] = await Promise.all([
    getRateRangesByMachineType(),
    db.machine.findMany({
      where: { approvalStatus: { not: "REJECTED" } },
      select: { machineTypeId: true, rate: true },
    }),
  ]);
  const outside = machines.filter((machine) => {
    const range = ranges[machine.machineTypeId];
    return !range || !isRateAllowed(machine.rate, range);
  });
  return outside.length;
}

// ─────────────────────────── Changing ───────────────────────────

/** Turns form values into PricingRule columns. The season runs from the first day 00:00 to the last day 23:59:59. */
function toRuleData(input: PricingRuleInput) {
  const hasSeason = input.harvestSeasonStart !== "";
  return {
    minRate: input.minRate,
    maxRate: input.maxRate,
    seasonCapPercent: input.seasonCapPercent,
    harvestSeasonStart: hasSeason ? startOfDhakaDay(input.harvestSeasonStart) : null,
    harvestSeasonEnd: hasSeason ? endOfDhakaDay(input.harvestSeasonEnd) : null,
    deliveryRatePerKm: input.deliveryRatePerKm,
    freeKm: input.freeKm,
    minCharge: input.minCharge,
  };
}

/** The message a provider gets when the new limit leaves their machine's rate outside. */
function rateOutsideMessage(
  machine: { id: string; brand: string; model: string; rate: number },
  machineType: { name: string; nameBn: string },
  range: RateRange,
) {
  const name = `${machine.brand} ${machine.model}`;
  return {
    title: "Price limit changed",
    titleBn: "দামের সীমা বদলেছে",
    body:
      `The government set a new limit for ${machineType.name}: ${range.minRate}–${range.maxRate} Tk. ` +
      `Your ${name} (rate ${machine.rate} Tk) is outside it. Please edit the rate; farmers cannot find this machine until then.`,
    bodyBn:
      `সরকার ${machineType.nameBn} এর নতুন সীমা ঠিক করেছে: ${toBanglaDigits(range.minRate)}–${toBanglaDigits(range.maxRate)} টাকা। ` +
      `আপনার ${name} (ভাড়া ${toBanglaDigits(machine.rate)} টাকা) এই সীমার বাইরে। ভাড়া বদলে নিন; তার আগে কৃষকেরা যন্ত্রটি খুঁজে পাবেন না।`,
    link: `/provider/machines/${machine.id}`,
  };
}

/**
 * Saves new price limits for one machine type (done by a GOVT user).
 * In ONE transaction: closes the old rule, starts the new one, writes the audit log,
 * and messages the owner of every machine whose rate is now outside the limit.
 * Returns how many machines are outside, so the page can say so.
 */
export async function savePricingRule(
  machineTypeId: string,
  input: PricingRuleInput,
  govtUserId: string,
): Promise<PricingRuleSaveResult> {
  const machineType = await getMachineType(machineTypeId);
  if (!machineType) {
    return { ok: false, error: "notFound" };
  }

  const now = new Date();
  const data = toRuleData(input);
  const range = getAllowedRateRange(data, now); // the limit providers must follow from today

  const machinesOutside = await db.$transaction(async (tx) => {
    // 1. Close the rule that is in force now (it stays in the table as history).
    await tx.pricingRule.updateMany({
      where: { machineTypeId, OR: [{ activeTo: null }, { activeTo: { gt: now } }] },
      data: { activeTo: now },
    });

    // 2. Start the new rule. The billing unit always comes from the machine type.
    const rule = await tx.pricingRule.create({
      data: { ...data, machineTypeId, billingUnit: machineType.billingUnit, activeFrom: now },
    });

    // 3. Remember who changed the limit, and to what.
    await writeAuditLog(
      {
        actorId: govtUserId,
        action: "PRICING_RULE_UPDATED",
        entityType: "PricingRule",
        entityId: rule.id,
        details:
          `${machineType.name}: ${input.minRate}–${input.maxRate} Tk, +${input.seasonCapPercent}% in season, ` +
          `delivery ${input.deliveryRatePerKm} Tk/km after ${input.freeKm} km, minimum ${input.minCharge}`,
      },
      tx,
    );

    // 4. Tell the owner of each machine whose rate no longer fits.
    const machines = await tx.machine.findMany({
      where: { machineTypeId, approvalStatus: { not: "REJECTED" } },
      select: { id: true, brand: true, model: true, rate: true, providerId: true },
    });
    const outside = machines.filter((machine) => !isRateAllowed(machine.rate, range));
    for (const machine of outside) {
      await createNotification(
        { userId: machine.providerId, ...rateOutsideMessage(machine, machineType, range) },
        tx,
      );
    }
    return outside.length;
  });

  return { ok: true, machinesOutside };
}
