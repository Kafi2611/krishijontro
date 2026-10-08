// Unit tests for src/lib/services/geo.ts (distance, land units and the Bangladesh map box).
import { describe, expect, it } from "vitest";
import {
  decimalToAcre,
  decimalToBigha,
  distanceInKm,
  isInsideBangladesh,
  toDecimal,
} from "@/lib/services/geo";

describe("distanceInKm (Haversine)", () => {
  it("returns 0 for the same point", () => {
    const rajshahi = { lat: 24.3745, lng: 88.6042 };
    expect(distanceInKm(rajshahi, rajshahi)).toBe(0);
  });

  it("returns about 111.2 km for one degree of longitude at the equator", () => {
    expect(distanceInKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBe(111.2);
  });

  it("gives the same distance in both directions", () => {
    const rajshahi = { lat: 24.3745, lng: 88.6042 };
    const dhaka = { lat: 23.8103, lng: 90.4125 };
    expect(distanceInKm(rajshahi, dhaka)).toBe(distanceInKm(dhaka, rajshahi));
  });

  it("finds Rajshahi to Dhaka is roughly 195 km in a straight line", () => {
    const rajshahi = { lat: 24.3745, lng: 88.6042 };
    const dhaka = { lat: 23.8103, lng: 90.4125 };
    const distance = distanceInKm(rajshahi, dhaka);
    expect(distance).toBeGreaterThan(190);
    expect(distance).toBeLessThan(200);
  });
});

describe("land unit conversion", () => {
  it("converts bigha and acre into decimal", () => {
    expect(toDecimal(2, "BIGHA")).toBe(66);
    expect(toDecimal(1.5, "ACRE")).toBe(150);
    expect(toDecimal(40, "DECIMAL")).toBe(40);
  });

  it("converts decimal into acre and bigha", () => {
    expect(decimalToAcre(66)).toBe(0.66);
    expect(decimalToBigha(66)).toBe(2);
  });
});

describe("isInsideBangladesh", () => {
  it("accepts places in Bangladesh", () => {
    expect(isInsideBangladesh({ lat: 24.3745, lng: 88.6042 })).toBe(true); // Rajshahi
    expect(isInsideBangladesh({ lat: 22.3569, lng: 91.7832 })).toBe(true); // Chattogram
  });

  it("rejects places far outside Bangladesh", () => {
    expect(isInsideBangladesh({ lat: 28.6139, lng: 77.209 })).toBe(false); // Delhi
    expect(isInsideBangladesh({ lat: 0, lng: 0 })).toBe(false); // a forgotten (empty) point
  });
});
