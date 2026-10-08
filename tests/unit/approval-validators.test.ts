// Unit tests for the admin's approve/reject rule and the provider + operator forms
// (src/lib/validators/approval.ts, provider.ts, operator.ts).
import { describe, expect, it } from "vitest";
import { approvalDecisionSchema } from "@/lib/validators/approval";
import { operatorSchema } from "@/lib/validators/operator";
import { NID_REGEX } from "@/lib/validators/provider";

describe("approvalDecisionSchema", () => {
  it("lets the admin approve without a reason", () => {
    expect(approvalDecisionSchema.safeParse({ approve: true, reason: "" }).success).toBe(true);
  });

  it("needs a reason of at least 3 letters to reject", () => {
    const result = approvalDecisionSchema.safeParse({ approve: false, reason: " " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("reasonRequired");
    expect(approvalDecisionSchema.safeParse({ approve: false, reason: "NID unclear" }).success).toBe(true);
  });
});

describe("NID_REGEX", () => {
  it("accepts 10, 13 and 17 digit National ID numbers", () => {
    expect(NID_REGEX.test("1234567890")).toBe(true);
    expect(NID_REGEX.test("1985817654321")).toBe(true);
    expect(NID_REGEX.test("19858176543210123")).toBe(true);
  });

  it("rejects other lengths and letters", () => {
    expect(NID_REGEX.test("12345")).toBe(false);
    expect(NID_REGEX.test("12345678901")).toBe(false);
    expect(NID_REGEX.test("12345abcde")).toBe(false);
  });
});

describe("operatorSchema", () => {
  const operator = {
    name: "Shamim Reza",
    phone: "01730000005",
    password: "op1234",
    licenseNo: "",
    experienceYears: 3,
  };

  it("accepts a correct operator", () => {
    expect(operatorSchema.safeParse(operator).success).toBe(true);
  });

  it("checks the phone number and password length", () => {
    const badPhone = operatorSchema.safeParse({ ...operator, phone: "12345" });
    expect(badPhone.error?.issues[0].message).toBe("phoneInvalid");
    const shortPassword = operatorSchema.safeParse({ ...operator, password: "123" });
    expect(shortPassword.error?.issues[0].message).toBe("passwordShort");
  });
});
