// Unit tests for the "is this subsidy program open?" rule in src/lib/services/subsidy.ts.
import { describe, expect, it } from "vitest";
import { isProgramOpen } from "@/lib/services/subsidy";

// The seeded program: July 2026 – June 2027, 500,000 Tk budget.
const program = {
  isActive: true,
  startAt: new Date("2026-07-01T00:00:00+06:00"),
  endAt: new Date("2027-06-30T23:59:59+06:00"),
  budget: 500000,
  usedAmount: 1200,
};
const today = new Date("2026-10-13T10:00:00+06:00");

describe("isProgramOpen", () => {
  it("is open when switched on, inside its dates and with money left", () => {
    expect(isProgramOpen(program, today)).toBe(true);
  });

  it("is closed before it starts and after it ends", () => {
    expect(isProgramOpen(program, new Date("2026-06-30T10:00:00+06:00"))).toBe(false);
    expect(isProgramOpen(program, new Date("2027-07-01T10:00:00+06:00"))).toBe(false);
  });

  it("is closed when the government switched it off", () => {
    expect(isProgramOpen({ ...program, isActive: false }, today)).toBe(false);
  });

  it("is closed when the whole budget is used", () => {
    expect(isProgramOpen({ ...program, usedAmount: 500000 }, today)).toBe(false);
  });
});
