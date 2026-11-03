// Unit tests for the cooperative leader's forms (validators/cooperative.ts).
import { describe, expect, it } from "vitest";
import { addMemberSchema, cooperativeSchema } from "@/lib/validators/cooperative";

describe("cooperativeSchema", () => {
  const cooperative = { name: "Haripur Krishi Samabay Samity", upazilaId: "u1", village: "Haripur", registrationNo: "" };

  it("accepts a cooperative without a registration number", () => {
    expect(cooperativeSchema.safeParse(cooperative).success).toBe(true);
  });

  it("needs a name, an upazila and a village", () => {
    expect(cooperativeSchema.safeParse({ ...cooperative, name: "Hi" }).error?.issues[0].message).toBe("nameRequired");
    expect(cooperativeSchema.safeParse({ ...cooperative, upazilaId: "" }).error?.issues[0].message).toBe("chooseUpazila");
    expect(cooperativeSchema.safeParse({ ...cooperative, village: " " }).error?.issues[0].message).toBe("required");
  });
});

describe("addMemberSchema", () => {
  it("needs an 11-digit Bangladesh mobile number", () => {
    expect(addMemberSchema.safeParse({ phone: "01710000001" }).success).toBe(true);
    expect(addMemberSchema.safeParse({ phone: "1710000001" }).error?.issues[0].message).toBe("phoneInvalid");
  });
});
