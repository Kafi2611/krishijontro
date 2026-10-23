// Unit tests for the subsidy rules in src/lib/services/subsidy.ts: is a program open, may a
// farmer apply, and may the officer approve.
import { describe, expect, it } from "vitest";
import { getApplyProblem, getApprovalProblem, isProgramOpen } from "@/lib/services/subsidy";

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

describe("getApplyProblem", () => {
  // The seeded program is for farmers with 200 decimal of land or less.
  const smallFarmerProgram = { ...program, maxLandDecimal: 200 };
  const farmer = { nid: "1990817123456", landDecimal: 150, verificationStatus: "PENDING" as const };

  it("lets a farmer who sent their details apply (verification can come later)", () => {
    expect(getApplyProblem(smallFarmerProgram, farmer, today)).toBeNull();
  });

  it("asks for the NID and land first", () => {
    expect(getApplyProblem(smallFarmerProgram, { ...farmer, nid: null }, today)).toBe("fillDetailsFirst");
    expect(getApplyProblem(smallFarmerProgram, { ...farmer, verificationStatus: "REJECTED" }, today)).toBe("fillDetailsFirst");
  });

  it("refuses a farmer with more land than the program allows", () => {
    expect(getApplyProblem(smallFarmerProgram, { ...farmer, landDecimal: 320 }, today)).toBe("landTooBig");
    // A program without a land limit is for any farmer.
    expect(getApplyProblem({ ...program, maxLandDecimal: null }, { ...farmer, landDecimal: 320 }, today)).toBeNull();
  });

  it("refuses when the program is closed", () => {
    expect(getApplyProblem({ ...smallFarmerProgram, isActive: false }, farmer, today)).toBe("programClosed");
  });
});

describe("getApprovalProblem", () => {
  const smallFarmerProgram = { ...program, maxLandDecimal: 200 };

  it("needs a verified farmer", () => {
    const pending = { nid: "1990817123456", landDecimal: 150, verificationStatus: "PENDING" as const };
    expect(getApprovalProblem(smallFarmerProgram, pending, today)).toBe("farmerNotVerified");
    expect(getApprovalProblem(smallFarmerProgram, { ...pending, verificationStatus: "VERIFIED" }, today)).toBeNull();
  });

  it("still checks the land limit for a verified farmer", () => {
    const bigFarmer = { nid: "1990817123456", landDecimal: 320, verificationStatus: "VERIFIED" as const };
    expect(getApprovalProblem(smallFarmerProgram, bigFarmer, today)).toBe("landTooBig");
  });
});
