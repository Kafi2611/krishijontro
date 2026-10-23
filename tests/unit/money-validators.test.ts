// Unit tests for the Phase 5 form rules: the admin's refund and payout forms
// (src/lib/validators/payment.ts), the farmer's NID and land form (verification.ts),
// and the subsidy application and program forms (subsidy.ts).
import { describe, expect, it } from "vitest";
import { payoutSchema, refundSchema } from "@/lib/validators/payment";
import { subsidyApplicationSchema, subsidyProgramSchema } from "@/lib/validators/subsidy";
import { farmerDetailsSchema } from "@/lib/validators/verification";

/** The first error message of a failed check, e.g. "wholeTaka". */
function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0].message;
}

describe("refundSchema", () => {
  it("accepts whole taka and a reason", () => {
    expect(refundSchema.safeParse({ amount: 200, reason: "Field was smaller" }).success).toBe(true);
  });

  it("refuses paisa, 0 and a missing reason", () => {
    expect(firstError(refundSchema.safeParse({ amount: 10.5, reason: "Field was smaller" }))).toBe("wholeTaka");
    expect(firstError(refundSchema.safeParse({ amount: 0, reason: "Field was smaller" }))).toBe("numberInvalid");
    expect(firstError(refundSchema.safeParse({ amount: 200, reason: "  " }))).toBe("reasonRequired");
  });
});

describe("payoutSchema", () => {
  it("needs the transfer reference", () => {
    expect(payoutSchema.safeParse({ reference: "bKash TRX 9KJ27XQ1" }).success).toBe(true);
    expect(firstError(payoutSchema.safeParse({ reference: "ab" }))).toBe("referenceRequired");
  });
});

describe("farmerDetailsSchema", () => {
  const details = { nid: "1990817123456", landValue: 2, landUnit: "BIGHA", village: "Haripur", locationId: "paba" };

  it("accepts a correct NID, land, village and upazila", () => {
    expect(farmerDetailsSchema.safeParse(details).success).toBe(true);
  });

  it("refuses a wrong NID, no land and no upazila", () => {
    expect(firstError(farmerDetailsSchema.safeParse({ ...details, nid: "12345" }))).toBe("nidInvalid");
    expect(firstError(farmerDetailsSchema.safeParse({ ...details, landValue: 0 }))).toBe("numberInvalid");
    expect(firstError(farmerDetailsSchema.safeParse({ ...details, locationId: "" }))).toBe("required");
  });
});

describe("subsidyApplicationSchema", () => {
  it("allows an empty message, but not a very long one", () => {
    expect(subsidyApplicationSchema.safeParse({ note: "" }).success).toBe(true);
    expect(firstError(subsidyApplicationSchema.safeParse({ note: "a".repeat(301) }))).toBe("tooLong");
  });
});

describe("subsidyProgramSchema", () => {
  const program = {
    name: "Small Farmer Support",
    nameBn: "ক্ষুদ্র কৃষক সহায়তা",
    description: "",
    discountPercent: 20,
    maxLandDecimal: 200,
    budget: 500000,
    startDay: "2026-07-01",
    endDay: "2027-06-30",
    isActive: true,
  };

  it("accepts a normal program, with or without a land limit", () => {
    expect(subsidyProgramSchema.safeParse(program).success).toBe(true);
    expect(subsidyProgramSchema.safeParse({ ...program, maxLandDecimal: undefined }).success).toBe(true);
  });

  it("keeps the discount between 1 and 50 %", () => {
    expect(firstError(subsidyProgramSchema.safeParse({ ...program, discountPercent: 0 }))).toBe("discountInvalid");
    expect(firstError(subsidyProgramSchema.safeParse({ ...program, discountPercent: 60 }))).toBe("discountInvalid");
  });

  it("refuses a last day before the first day", () => {
    const result = subsidyProgramSchema.safeParse({ ...program, endDay: "2026-06-30" });
    expect(firstError(result)).toBe("endBeforeStart");
  });
});
