// Unit tests for the government's price limit form rules (src/lib/validators/pricing-rule.ts).
import { describe, expect, it } from "vitest";
import { pricingRuleSchema, type PricingRuleInput } from "@/lib/validators/pricing-rule";

// A correct form: the seeded combine harvester limit.
const validRule: PricingRuleInput = {
  minRate: 2400,
  maxRate: 3500,
  seasonCapPercent: 15,
  harvestSeasonStart: "2026-11-01",
  harvestSeasonEnd: "2026-12-31",
  deliveryRatePerKm: 60,
  freeKm: 3,
  minCharge: 1,
};

/** The error message keys Zod gives for a form, e.g. ["maxBelowMin"]. */
function errorKeys(rule: PricingRuleInput): string[] {
  const result = pricingRuleSchema.safeParse(rule);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("pricingRuleSchema", () => {
  it("accepts a correct limit", () => {
    expect(errorKeys(validRule)).toEqual([]);
  });

  it("accepts a limit without a harvest season (both dates empty)", () => {
    expect(errorKeys({ ...validRule, harvestSeasonStart: "", harvestSeasonEnd: "" })).toEqual([]);
  });

  it("accepts the same lowest and highest rate", () => {
    expect(errorKeys({ ...validRule, minRate: 3000, maxRate: 3000 })).toEqual([]);
  });

  it("refuses a highest rate below the lowest rate", () => {
    expect(errorKeys({ ...validRule, minRate: 3000, maxRate: 2500 })).toEqual(["maxBelowMin"]);
  });

  it("refuses only one season date", () => {
    expect(errorKeys({ ...validRule, harvestSeasonEnd: "" })).toEqual(["seasonDatesBoth"]);
    expect(errorKeys({ ...validRule, harvestSeasonStart: "" })).toEqual(["seasonDatesBoth"]);
  });

  it("refuses a season that ends before it starts", () => {
    expect(errorKeys({ ...validRule, harvestSeasonEnd: "2026-10-15" })).toEqual(["endBeforeStart"]);
  });

  it("refuses paisa and a season cap above 50%", () => {
    expect(errorKeys({ ...validRule, minRate: 2400.5 })).toEqual(["wholeTaka"]);
    expect(errorKeys({ ...validRule, seasonCapPercent: 60 })).toEqual(["percentInvalid"]);
  });

  it("allows half km and half units, but not negative ones", () => {
    expect(errorKeys({ ...validRule, freeKm: 2.5, minCharge: 0.5 })).toEqual([]);
    expect(errorKeys({ ...validRule, minCharge: -1 })).toEqual(["numberInvalid"]);
  });
});
