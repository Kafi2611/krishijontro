// Unit tests for the login/register Zod rules in src/lib/validators/auth.ts.
import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validators/auth";

const validRegistration = {
  name: "Abdul Karim",
  phone: "01712345678",
  password: "secret12",
  confirmPassword: "secret12",
  role: "FARMER",
  providerType: "INDIVIDUAL",
};

describe("loginSchema", () => {
  it("accepts an 11-digit Bangladesh mobile number", () => {
    expect(loginSchema.safeParse({ phone: "01700000001", password: "x" }).success).toBe(true);
  });

  it("rejects wrong phone numbers", () => {
    for (const phone of ["0170000000", "017000000012", "02700000001", "01200000001", "abc"]) {
      const result = loginSchema.safeParse({ phone, password: "x" });
      expect(result.success).toBe(false);
    }
  });
});

describe("registerSchema", () => {
  it("accepts a correct form", () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it("shows 'passwordsDontMatch' under the confirm box when passwords differ", () => {
    const result = registerSchema.safeParse({ ...validRegistration, confirmPassword: "other123" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("passwordsDontMatch");
    expect(result.error?.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("rejects short passwords", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "abc",
      confirmPassword: "abc",
    });
    expect(result.error?.issues[0].message).toBe("passwordShort");
  });

  it("does not let people register as staff (for example ADMIN)", () => {
    const result = registerSchema.safeParse({ ...validRegistration, role: "ADMIN" });
    expect(result.success).toBe(false);
  });
});
