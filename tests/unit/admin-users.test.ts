// Unit tests for the admin's Users page: the list filters in the address (lib/list-params.ts),
// the suspend / activate form rule (validators/user.ts) and the staff account form (validators/staff.ts).
import { describe, expect, it } from "vitest";
import { listHref, readChoice, readPageNumber, readSearchText } from "@/lib/list-params";
import { staffSchema } from "@/lib/validators/staff";
import { userStatusSchema } from "@/lib/validators/user";

describe("list filters in the address", () => {
  it("reads the page number, starting at 1", () => {
    expect(readPageNumber("3")).toBe(3);
    expect(readPageNumber(undefined)).toBe(1);
    expect(readPageNumber("0")).toBe(1);
    expect(readPageNumber("2.5")).toBe(1);
    expect(readPageNumber("abc")).toBe(1);
    expect(readPageNumber(["4", "5"])).toBe(4);
  });

  it("trims the search words and keeps at most 50 letters", () => {
    expect(readSearchText("  karim ")).toBe("karim");
    expect(readSearchText(undefined)).toBe("");
    expect(readSearchText("x".repeat(80))).toHaveLength(50);
  });

  it("accepts only an allowed choice", () => {
    const roles = ["FARMER", "ADMIN"] as const;
    expect(readChoice("FARMER", roles)).toBe("FARMER");
    expect(readChoice("farmer", roles)).toBeNull();
    expect(readChoice(undefined, roles)).toBeNull();
  });

  it("builds the address without empty filters or page 1", () => {
    expect(listHref("/admin/users", { role: "FARMER", q: "", page: 2 })).toBe("/admin/users?role=FARMER&page=2");
    expect(listHref("/admin/users", { role: null, q: "karim", page: 1 })).toBe("/admin/users?q=karim");
    expect(listHref("/admin/users", {})).toBe("/admin/users");
  });
});

describe("userStatusSchema", () => {
  it("needs a reason to suspend", () => {
    const result = userStatusSchema.safeParse({ status: "SUSPENDED", reason: "  " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("reasonRequired");
    expect(userStatusSchema.safeParse({ status: "SUSPENDED", reason: "Fake NID" }).success).toBe(true);
  });

  it("activates without a reason", () => {
    expect(userStatusSchema.safeParse({ status: "ACTIVE", reason: "" }).success).toBe(true);
  });

  it("refuses any other status", () => {
    expect(userStatusSchema.safeParse({ status: "DELETED", reason: "x" }).success).toBe(false);
  });
});

describe("staffSchema", () => {
  const officer = {
    role: "OFFICER" as const,
    name: "Nasrin Akter",
    phone: "01750000001",
    password: "secret12",
    upazilaId: "upazila-1",
    designation: "Upazila Agriculture Officer",
    skills: "",
  };

  it("accepts a full officer account", () => {
    expect(staffSchema.safeParse(officer).success).toBe(true);
  });

  it("needs the upazila of an officer", () => {
    const result = staffSchema.safeParse({ ...officer, upazilaId: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["upazilaId"]);
    expect(result.error?.issues[0].message).toBe("chooseUpazila");
  });

  it("does not need an upazila for the other staff roles", () => {
    expect(staffSchema.safeParse({ ...officer, role: "TECHNICIAN", upazilaId: "" }).success).toBe(true);
    expect(staffSchema.safeParse({ ...officer, role: "GOVT", upazilaId: "" }).success).toBe(true);
  });

  it("refuses roles that sign up themselves or are added by a provider", () => {
    expect(staffSchema.safeParse({ ...officer, role: "FARMER" }).success).toBe(false);
    expect(staffSchema.safeParse({ ...officer, role: "OPERATOR" }).success).toBe(false);
  });

  it("checks the mobile number and the password length", () => {
    expect(staffSchema.safeParse({ ...officer, phone: "0175" }).error?.issues[0].message).toBe("phoneInvalid");
    expect(staffSchema.safeParse({ ...officer, password: "123" }).error?.issues[0].message).toBe("passwordShort");
  });
});
