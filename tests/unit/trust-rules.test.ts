// Unit tests for src/lib/services/trust-rules.ts: the provider's trust score.
import { describe, expect, it } from "vitest";
import { calculateTrustScore, getCancellationWindowStart } from "@/lib/services/trust-rules";

describe("calculateTrustScore", () => {
  it("gives 20 points per star", () => {
    expect(calculateTrustScore({ averageRating: 4.5, recentCancellations: 0 })).toBe(90);
    expect(calculateTrustScore({ averageRating: 5, recentCancellations: 0 })).toBe(100);
  });

  it("takes off 5 points for each recent cancellation", () => {
    expect(calculateTrustScore({ averageRating: 4.5, recentCancellations: 1 })).toBe(85);
    expect(calculateTrustScore({ averageRating: 4.5, recentCancellations: 2 })).toBe(80);
  });

  it("starts a provider without reviews at 80", () => {
    expect(calculateTrustScore({ averageRating: null, recentCancellations: 0 })).toBe(80);
  });

  it("stays between 0 and 100", () => {
    expect(calculateTrustScore({ averageRating: 1, recentCancellations: 5 })).toBe(0);
  });
});

describe("getCancellationWindowStart", () => {
  it("is 90 days before now", () => {
    const now = new Date("2026-10-27T00:00:00Z");
    expect(getCancellationWindowStart(now).toISOString()).toBe("2026-07-29T00:00:00.000Z");
  });
});
