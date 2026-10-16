// Unit tests for the pure parts of the farmer search:
// the price estimate (estimateJob in src/lib/services/pricing.ts), the sort
// (src/lib/services/search.ts), and reading/writing the search in the page address
// (src/lib/validators/search.ts).
import { describe, expect, it } from "vitest";
import { addDays, toDhakaDay } from "@/lib/services/calendar";
import { estimateJob } from "@/lib/services/pricing";
import type { PricedMachineType } from "@/lib/services/pricing-rule";
import { sortSearchResults } from "@/lib/services/search";
import { searchInputToQuery, searchParamsToInput, type MachineSearchInput } from "@/lib/validators/search";

// The seeded tractor type: 2000–3000 Tk per acre, 3 free km, 50 Tk/km, minimum 0.5 acre.
const tractorType: PricedMachineType = {
  id: "tractor",
  name: "Tractor",
  nameBn: "ট্রাক্টর",
  icon: "Tractor",
  workTypes: ["TILLING"],
  billingUnit: "PER_ACRE",
  minRate: 2000,
  maxRate: 3000,
  freeKm: 3,
  deliveryRatePerKm: 50,
  minCharge: 0.5,
};

describe("estimateJob", () => {
  it("measures the distance and prices the job like the project example", () => {
    const machine = { rate: 2400, lat: 24.43, lng: 88.61 };
    // A field 8 km north of the machine (1 km ≈ 0.008993° of latitude)
    const field = { lat: 24.43 + 8 * 0.008993, lng: 88.61 };
    const estimate = estimateJob(machine, tractorType, { landDecimal: 66, hoursOrDays: 0, field }, 20, 3);

    expect(estimate.distanceKm).toBe(8);
    expect(estimate.quantity).toBe(0.66);
    expect(estimate.price.totalAmount).toBe(1517);
    expect(estimate.price.providerAmount).toBe(1779);
  });
});

describe("sortSearchResults", () => {
  const near = { name: "near", distanceKm: 1, trustScore: 70, price: { totalAmount: 3000 } };
  const far = { name: "far", distanceKm: 9, trustScore: 90, price: { totalAmount: 2000 } };
  const nearTrusted = { name: "nearTrusted", distanceKm: 1, trustScore: 95, price: { totalAmount: 3000 } };

  it("puts the nearest first, and the more trusted provider first at the same distance", () => {
    const sorted = sortSearchResults([far, near, nearTrusted], "nearest");
    expect(sorted.map((result) => result.name)).toEqual(["nearTrusted", "near", "far"]);
  });

  it("puts the cheapest first, and the nearer one first at the same price", () => {
    const cheapNear = { ...far, name: "cheapNear", distanceKm: 2 };
    const sorted = sortSearchResults([near, far, cheapNear], "cheapest");
    expect(sorted.map((result) => result.name)).toEqual(["cheapNear", "far", "near"]);
  });

  it("does not change the list it was given", () => {
    const list = [far, near];
    sortSearchResults(list, "nearest");
    expect(list.map((result) => result.name)).toEqual(["far", "near"]);
  });
});

describe("search in the page address", () => {
  const tomorrow = addDays(toDhakaDay(new Date()), 1);
  const search: MachineSearchInput = {
    workType: "TILLING",
    machineTypeId: "",
    landValue: 66,
    landUnit: "DECIMAL",
    hoursOrDays: 2,
    day: tomorrow,
    lat: 24.43,
    lng: 88.61,
    maxKm: 15,
    sort: "nearest",
  };

  /** Turns "a=1&b=2" into { a: "1", b: "2" }, like Next.js gives searchParams to a page. */
  function toParams(query: string): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(query));
  }

  it("reads back exactly the search it wrote", () => {
    const query = searchInputToQuery(search);
    expect(query).toContain("workType=TILLING");
    expect(searchParamsToInput(toParams(query))).toEqual(search);
  });

  it("accepts Bangla digits typed into the address", () => {
    const params = { ...toParams(searchInputToQuery(search)), landValue: "৬৬" };
    expect(searchParamsToInput(params)?.landValue).toBe(66);
  });

  it("refuses a wrong or missing value", () => {
    const params = toParams(searchInputToQuery(search));
    expect(searchParamsToInput({ ...params, workType: "FLYING" })).toBeNull();
    expect(searchParamsToInput({ ...params, landValue: "abc" })).toBeNull();
    expect(searchParamsToInput({ ...params, lat: "51.5" })).toBeNull(); // London, not Bangladesh
    expect(searchParamsToInput({})).toBeNull();
  });

  it("refuses a day in the past or too far ahead", () => {
    const params = toParams(searchInputToQuery(search));
    expect(searchParamsToInput({ ...params, day: addDays(tomorrow, -2) })).toBeNull();
    expect(searchParamsToInput({ ...params, day: addDays(tomorrow, 90) })).toBeNull();
  });
});
