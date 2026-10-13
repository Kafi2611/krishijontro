// Unit tests for src/lib/services/pricing.ts: the government rate limits (part 1)
// and the price of a booking (part 2).
import { describe, expect, it } from "vitest";
import {
  calculateBookingPrice,
  getAllowedRateRange,
  getBillingQuantity,
  getSeasonMaxRate,
  isInHarvestSeason,
  isRateAllowed,
  type BookingPriceInput,
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

describe("getSeasonMaxRate", () => {
  it("raises the max by the season cap and rounds down", () => {
    expect(getSeasonMaxRate({ maxRate: 3000, seasonCapPercent: 10 })).toBe(3300);
    expect(getSeasonMaxRate({ maxRate: 2999, seasonCapPercent: 15 })).toBe(3448); // 3448.85
    expect(getSeasonMaxRate({ maxRate: 3000, seasonCapPercent: 0 })).toBe(3000);
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

describe("getBillingQuantity", () => {
  it("turns land into acres for machines rented per acre", () => {
    expect(getBillingQuantity("PER_ACRE", 66, 0)).toBe(0.66);
    expect(getBillingQuantity("PER_ACRE", 150, 0)).toBe(1.5);
  });

  it("uses the hours or days the farmer asked for otherwise", () => {
    expect(getBillingQuantity("PER_HOUR", 66, 5)).toBe(5);
    expect(getBillingQuantity("PER_DAY", 66, 2)).toBe(2);
  });
});

describe("calculateBookingPrice", () => {
  // The worked example from the project brief.
  const projectExample: BookingPriceInput = {
    quantity: getBillingQuantity("PER_ACRE", 66, 0), // 66 decimal = 0.66 acre
    rate: 2400,
    minCharge: 0.5,
    distanceKm: 8,
    freeKm: 3,
    deliveryRatePerKm: 50,
    subsidyPercent: 20,
    platformFeePercent: 3,
  };

  it("matches the project example exactly", () => {
    const price = calculateBookingPrice(projectExample);
    expect(price.workCharge).toBe(1584); // 0.66 × 2400
    expect(price.deliveryCharge).toBe(250); // (8 − 3) × 50
    expect(price.subsidyAmount).toBe(317); // 1584 × 20% = 316.8 -> 317
    expect(price.totalAmount).toBe(1517); // 1584 + 250 − 317
    expect(price.platformFee).toBe(55); // (1584 + 250) × 3% = 55.02 -> 55
    expect(price.providerAmount).toBe(1779); // 1584 + 250 − 55
  });

  it("gives no subsidy when the farmer has none", () => {
    const price = calculateBookingPrice({ ...projectExample, subsidyPercent: 0 });
    expect(price.subsidyAmount).toBe(0);
    expect(price.totalAmount).toBe(1834); // 1584 + 250
    // The provider's share does not depend on the subsidy (the government pays that part).
    expect(price.providerAmount).toBe(1779);
  });

  it("bills at least the minimum quantity", () => {
    // 20 decimal = 0.2 acre, but the minimum is 0.5 acre -> 0.5 × 2400 = 1200
    const price = calculateBookingPrice({ ...projectExample, quantity: 0.2 });
    expect(price.billedQuantity).toBe(0.5);
    expect(price.workCharge).toBe(1200);
  });

  it("charges no delivery inside the free km", () => {
    const near = calculateBookingPrice({ ...projectExample, distanceKm: 2 });
    expect(near.chargedKm).toBe(0);
    expect(near.deliveryCharge).toBe(0);

    const exactlyFree = calculateBookingPrice({ ...projectExample, distanceKm: 3 });
    expect(exactlyFree.deliveryCharge).toBe(0);
  });

  it("charges part of a km and keeps the km tidy", () => {
    // 8.3 − 3 = 5.3 km (not 5.300000000000001) × 50 = 265
    const price = calculateBookingPrice({ ...projectExample, distanceKm: 8.3 });
    expect(price.chargedKm).toBe(5.3);
    expect(price.deliveryCharge).toBe(265);
  });

  it("works for a pump rented per hour", () => {
    // 5 hours × 200 Tk, 4 km away with 3 free km at 30 Tk/km, no subsidy
    const price = calculateBookingPrice({
      quantity: 5,
      rate: 200,
      minCharge: 2,
      distanceKm: 4,
      freeKm: 3,
      deliveryRatePerKm: 30,
      subsidyPercent: 0,
      platformFeePercent: 3,
    });
    expect(price.workCharge).toBe(1000);
    expect(price.deliveryCharge).toBe(30);
    expect(price.totalAmount).toBe(1030);
    expect(price.platformFee).toBe(31); // 1030 × 3% = 30.9 -> 31
    expect(price.providerAmount).toBe(999);
  });

  it("always gives whole taka", () => {
    const price = calculateBookingPrice({ ...projectExample, quantity: 0.37, distanceKm: 6.7 });
    for (const amount of [
      price.workCharge,
      price.deliveryCharge,
      price.subsidyAmount,
      price.totalAmount,
      price.platformFee,
      price.providerAmount,
    ]) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });
});
