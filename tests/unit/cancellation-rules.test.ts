// Unit tests for src/lib/services/cancellation-rules.ts: who may cancel, and the late fee.
import { describe, expect, it } from "vitest";
import {
  canFarmerCancel,
  canProviderCancel,
  getCancellationFee,
  getFreeCancellationEnd,
} from "@/lib/services/cancellation-rules";

const rules = { freeHours: 24, feePercent: 10 };
const startAt = new Date("2026-10-20T02:00:00Z"); // 8:00 AM in Dhaka
const hoursBeforeStart = (hours: number) => new Date(startAt.getTime() - hours * 60 * 60 * 1000);

describe("who may cancel", () => {
  it("lets the farmer cancel until the operator sets off", () => {
    expect(canFarmerCancel("REQUESTED")).toBe(true);
    expect(canFarmerCancel("ACCEPTED")).toBe(true);
    expect(canFarmerCancel("OPERATOR_ASSIGNED")).toBe(true);
    expect(canFarmerCancel("ON_THE_WAY")).toBe(false);
    expect(canFarmerCancel("WORKING")).toBe(false);
  });

  it("lets the provider cancel only a booking they accepted (a new request is rejected instead)", () => {
    expect(canProviderCancel("REQUESTED")).toBe(false);
    expect(canProviderCancel("ACCEPTED")).toBe(true);
    expect(canProviderCancel("OPERATOR_ASSIGNED")).toBe(true);
    expect(canProviderCancel("ON_THE_WAY")).toBe(false);
  });
});

describe("getCancellationFee", () => {
  const accepted = { status: "ACCEPTED" as const, startAt, workCharge: 1584 };

  it("is free until 24 hours before the start", () => {
    expect(getFreeCancellationEnd(startAt, 24).toISOString()).toBe("2026-10-19T02:00:00.000Z");
    expect(getCancellationFee(accepted, rules, hoursBeforeStart(48))).toBe(0);
    expect(getCancellationFee(accepted, rules, hoursBeforeStart(24))).toBe(0);
  });

  it("costs 10% of the work charge later", () => {
    expect(getCancellationFee(accepted, rules, hoursBeforeStart(5))).toBe(158);
  });

  it("is always free while the provider has not accepted yet", () => {
    expect(getCancellationFee({ ...accepted, status: "REQUESTED" }, rules, hoursBeforeStart(5))).toBe(0);
  });

  it("follows the settings", () => {
    expect(getCancellationFee(accepted, { freeHours: 48, feePercent: 20 }, hoursBeforeStart(30))).toBe(317);
  });
});
