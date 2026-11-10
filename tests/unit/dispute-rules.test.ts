// Unit tests for complaints: who may complain (dispute-rules.ts), the biggest fine, the work on
// the bill in the operator's unit, and the two forms (validators/dispute.ts).
import { describe, expect, it } from "vitest";
import { canRaiseDispute, getBilledWork, getBookingBadge, isFineAllowed } from "@/lib/services/dispute-rules";
import { complaintSchema, decisionSchema } from "@/lib/validators/dispute";

describe("canRaiseDispute", () => {
  it("allows a complaint once the work is done, paid or not", () => {
    expect(canRaiseDispute("COMPLETED", false)).toBe(true);
    expect(canRaiseDispute("PAID", false)).toBe(true);
  });

  it("refuses before the work is done, after the review, and a second complaint", () => {
    expect(canRaiseDispute("WORKING", false)).toBe(false);
    expect(canRaiseDispute("REVIEWED", false)).toBe(false);
    expect(canRaiseDispute("DISPUTED", false)).toBe(false);
    expect(canRaiseDispute("PAID", true)).toBe(false);
  });
});

describe("getBookingBadge", () => {
  it("says 'complaint open' only while the complaint really waits for a decision", () => {
    expect(getBookingBadge("DISPUTED", true)).toBe("DISPUTED");
  });

  it("says 'waiting for payment' once the admin has decided and the bill is still unpaid", () => {
    expect(getBookingBadge("DISPUTED", false)).toBe("PAYMENT_DUE");
  });

  it("shows every other status as it is", () => {
    expect(getBookingBadge("COMPLETED", false)).toBe("COMPLETED");
    expect(getBookingBadge("PAID", false)).toBe("PAID");
    expect(getBookingBadge("WORKING", false)).toBe("WORKING");
  });
});

describe("isFineAllowed", () => {
  it("allows 1 Tk up to the provider's share", () => {
    expect(isFineAllowed(300, 1779)).toBe(true);
    expect(isFineAllowed(1779, 1779)).toBe(true);
    expect(isFineAllowed(1780, 1779)).toBe(false);
    expect(isFineAllowed(0, 1779)).toBe(false);
  });
});

describe("getBilledWork", () => {
  it("gives decimal of land for machines rented per acre", () => {
    expect(getBilledWork({ billingUnit: "PER_ACRE", quantity: 0.8, actualQuantity: 0.66 })).toBe(66);
    expect(getBilledWork({ billingUnit: "PER_ACRE", quantity: 0.8, actualQuantity: null })).toBe(80);
  });

  it("gives hours or days unchanged", () => {
    expect(getBilledWork({ billingUnit: "PER_HOUR", quantity: 6, actualQuantity: 5.5 })).toBe(5.5);
    expect(getBilledWork({ billingUnit: "PER_DAY", quantity: 2, actualQuantity: null })).toBe(2);
  });
});

describe("complaintSchema", () => {
  it("needs a reason and a few words", () => {
    expect(complaintSchema.safeParse({ reason: "WRONG_AMOUNT", description: "Only 0.6 acre was done" }).success).toBe(true);
    expect(complaintSchema.safeParse({ reason: "WRONG_AMOUNT", description: "bad" }).error?.issues[0].message).toBe("describeProblem");
    expect(complaintSchema.safeParse({ reason: "ANGRY", description: "Only 0.6 acre was done" }).error?.issues[0].message).toBe("chooseReason");
  });
});

describe("decisionSchema", () => {
  const base = { decision: "NO_ACTION" as const, amountTk: 0, correctedWork: 0, note: "Checked with both sides" };

  it("accepts no action with a note", () => {
    expect(decisionSchema.safeParse(base).success).toBe(true);
    expect(decisionSchema.safeParse({ ...base, note: "" }).error?.issues[0].message).toBe("reasonRequired");
  });

  it("needs an amount for a fine", () => {
    expect(decisionSchema.safeParse({ ...base, decision: "PENALTY" }).error?.issues[0].message).toBe("amountRequired");
    expect(decisionSchema.safeParse({ ...base, decision: "PENALTY", amountTk: 300 }).success).toBe(true);
  });

  it("needs money back or the right work for a refund", () => {
    expect(decisionSchema.safeParse({ ...base, decision: "REFUND" }).error?.issues[0].message).toBe("amountRequired");
    expect(decisionSchema.safeParse({ ...base, decision: "REFUND", amountTk: 120 }).success).toBe(true);
    expect(decisionSchema.safeParse({ ...base, decision: "REFUND", correctedWork: 60 }).success).toBe(true);
  });

  it("wants whole taka", () => {
    expect(decisionSchema.safeParse({ ...base, decision: "PENALTY", amountTk: 12.5 }).error?.issues[0].message).toBe("wholeTaka");
  });
});
