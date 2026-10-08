// Unit tests for src/lib/services/machine-rules.ts and the machine form rules
// in src/lib/validators/machine.ts.
import { describe, expect, it } from "vitest";
import { canToggleActive, isMachineListed, needsNewApproval } from "@/lib/services/machine-rules";
import { machineSchema, type MachineInput } from "@/lib/validators/machine";

const tractor = {
  machineTypeId: "type-tractor",
  brand: "Mahindra",
  model: "575 DI",
  registrationNo: "RAJ-TR-1001",
};

describe("needsNewApproval", () => {
  it("keeps the approval when only rate, photos or place change", () => {
    // The checked details are the same, so nothing for the admin to re-check.
    expect(needsNewApproval({ ...tractor, approvalStatus: "APPROVED" }, { ...tractor })).toBe(false);
  });

  it("asks the admin again when the type, brand, model or registration changes", () => {
    const approved = { ...tractor, approvalStatus: "APPROVED" as const };
    expect(needsNewApproval(approved, { ...tractor, machineTypeId: "type-harvester" })).toBe(true);
    expect(needsNewApproval(approved, { ...tractor, brand: "Sonalika" })).toBe(true);
    expect(needsNewApproval(approved, { ...tractor, model: "DI 750" })).toBe(true);
    expect(needsNewApproval(approved, { ...tractor, registrationNo: null })).toBe(true);
  });

  it("always sends a rejected machine back for checking after an edit", () => {
    expect(needsNewApproval({ ...tractor, approvalStatus: "REJECTED" }, { ...tractor })).toBe(true);
  });
});

describe("canToggleActive", () => {
  it("lets the provider switch active and inactive machines", () => {
    expect(canToggleActive("ACTIVE")).toBe(true);
    expect(canToggleActive("INACTIVE")).toBe(true);
  });

  it("does not let the provider switch a machine that is being repaired", () => {
    expect(canToggleActive("UNDER_MAINTENANCE")).toBe(false);
  });
});

describe("isMachineListed", () => {
  const listed = { approvalStatus: "APPROVED", status: "ACTIVE", providerApprovalStatus: "APPROVED" } as const;

  it("shows an approved, active machine of an approved provider", () => {
    expect(isMachineListed(listed)).toBe(true);
  });

  it("hides it if the machine or provider is not approved, or it is not active", () => {
    expect(isMachineListed({ ...listed, approvalStatus: "PENDING" })).toBe(false);
    expect(isMachineListed({ ...listed, providerApprovalStatus: "PENDING" })).toBe(false);
    expect(isMachineListed({ ...listed, status: "INACTIVE" })).toBe(false);
    expect(isMachineListed({ ...listed, status: "UNDER_MAINTENANCE" })).toBe(false);
  });
});

describe("machineSchema", () => {
  const goodMachine: MachineInput = {
    machineTypeId: "type-tractor",
    brand: "Mahindra",
    model: "575 DI",
    year: 2021,
    horsePower: 47,
    registrationNo: "raj-tr-1001",
    description: "",
    rate: 2400,
    locationId: "upazila-paba",
    address: "Naohata Bazar",
    lat: 24.43,
    lng: 88.61,
    engineHours: 820,
    serviceDueHours: 1000,
    imageUrls: [],
  };

  /** The error message keys Zod gives for a machine (empty list = no errors). */
  function errorsOf(machine: unknown): string[] {
    const result = machineSchema.safeParse(machine);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  }

  it("accepts a correct machine and writes the registration number in capitals", () => {
    const result = machineSchema.parse(goodMachine);
    expect(result.registrationNo).toBe("RAJ-TR-1001");
  });

  it("allows an empty horse power (it is optional)", () => {
    expect(errorsOf({ ...goodMachine, horsePower: undefined })).toEqual([]);
  });

  it("rejects a year in the future or too old", () => {
    expect(errorsOf({ ...goodMachine, year: new Date().getFullYear() + 1 })).toEqual(["yearInvalid"]);
    expect(errorsOf({ ...goodMachine, year: 1950 })).toEqual(["yearInvalid"]);
  });

  it("wants the rate in whole taka", () => {
    expect(errorsOf({ ...goodMachine, rate: 2400.5 })).toEqual(["wholeTaka"]);
  });

  it("rejects a map point outside Bangladesh", () => {
    expect(errorsOf({ ...goodMachine, lat: 28.6, lng: 77.2 })).toEqual([
      "outsideBangladesh",
      "outsideBangladesh",
    ]);
  });

  it("rejects photo addresses that our upload service did not make", () => {
    expect(errorsOf({ ...goodMachine, imageUrls: ["https://evil.com/a.jpg"] })).toEqual([
      "somethingWrong",
    ]);
  });
});
