// Unit tests for the government rate limits in src/lib/services/pricing.ts.
import { describe, expect, it } from "vitest";
import {
  getAllowedRateRange,
  isInHarvestSeason,
  isRateAllowed,
  type RateLimitRule,
} from "@/lib/services/pricing";

// Combine harvester rule: 2400–3500 Tk per acre, +15% in the Aman harvest (Nov–Dec 2026).
const harvesterRule: RateLimitRule = {
  minRate: 2400,
  maxRate: 3500,
  seasonCapPercent: 15,
  harvestSeasonStart: new Date("2026-11-01T00:00:00+06:00"),
  harvestSeasonEnd: new Date("2026-12-31T23:59:59+06:00"),
};

// Tractor rule: 2000–3000 Tk per acre, no harvest season dates.
const tractorRule: RateLimitRule = {
  minRate: 2000,
  maxRate: 3000,
  seasonCapPercent: 10,
  harvestSeasonStart: null,
  harvestSeasonEnd: null,
};

describe("isInHarvestSeason", () => {
  it("is true inside the season, including the first and last moment", () => {
    expect(isInHarvestSeason(harvesterRule, new Date("2026-11-20T10:00:00+06:00"))).toBe(true);
    expect(isInHarvestSeason(harvesterRule, new Date("2026-11-01T00:00:00+06:00"))).toBe(true);
    expect(isInHarvestSeason(harvesterRule, new Date("2026-12-31T23:59:59+06:00"))).toBe(true);
  });

  it("is false outside the season", () => {
    expect(isInHarvestSeason(harvesterRule, new Date("2026-10-08T10:00:00+06:00"))).toBe(false);
    expect(isInHarvestSeason(harvesterRule, new Date("2027-01-01T00:00:00+06:00"))).toBe(false);
  });

  it("is always false for a rule without season dates", () => {
    expect(isInHarvestSeason(tractorRule, new Date("2026-11-20T10:00:00+06:00"))).toBe(false);
  });
});

describe("getAllowedRateRange", () => {
  it("uses the normal min and max outside the season", () => {
    const range = getAllowedRateRange(harvesterRule, new Date("2026-10-08T10:00:00+06:00"));
    expect(range).toEqual({ minRate: 2400, maxRate: 3500, inHarvestSeason: false });
  });

  it("raises only the max by the season cap inside the season", () => {
    // 3500 + 15% = 4025
    const range = getAllowedRateRange(harvesterRule, new Date("2026-11-20T10:00:00+06:00"));
    expect(range).toEqual({ minRate: 2400, maxRate: 4025, inHarvestSeason: true });
  });

  it("rounds the raised max down to whole taka", () => {
    // 2999 + 15% = 3448.85 -> 3448 (never above the cap)
    const rule = { ...harvesterRule, maxRate: 2999 };
    const range = getAllowedRateRange(rule, new Date("2026-11-20T10:00:00+06:00"));
    expect(range.maxRate).toBe(3448);
  });
});

describe("isRateAllowed", () => {
  const range = { minRate: 2000, maxRate: 3000 };

  it("accepts rates inside the range, including both ends", () => {
    expect(isRateAllowed(2000, range)).toBe(true);
    expect(isRateAllowed(2400, range)).toBe(true);
    expect(isRateAllowed(3000, range)).toBe(true);
  });

  it("rejects rates below the min or above the max", () => {
    expect(isRateAllowed(1999, range)).toBe(false);
    expect(isRateAllowed(3001, range)).toBe(false);
  });
});
