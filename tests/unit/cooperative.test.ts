// Unit tests for the cooperative leader's forms (validators/cooperative.ts and validators/group-booking.ts).
import { describe, expect, it } from "vitest";
import { addDays, toDhakaDay } from "@/lib/services/calendar";
import { addMemberSchema, cooperativeSchema } from "@/lib/validators/cooperative";
import { groupBookingSchema } from "@/lib/validators/group-booking";

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

describe("groupBookingSchema", () => {
  // Tomorrow at 8 AM is always at least 2 hours away.
  const tomorrow = addDays(toDhakaDay(new Date()), 1);
  const group = {
    workType: "TILLING" as const,
    machineTypeId: "type-1",
    day: tomorrow,
    startHour: 8,
    lat: 24.37,
    lng: 88.6,
    maxKm: 15,
    plots: [
      { farmerId: "f1", amount: 66, plotNote: "" },
      { farmerId: "f2", amount: 40, plotNote: "North of the pond" },
    ],
    machineId: "",
  };

  it("accepts two members' plots", () => {
    expect(groupBookingSchema.safeParse(group).success).toBe(true);
  });

  it("needs at least 2 plots and each member only once", () => {
    expect(groupBookingSchema.safeParse({ ...group, plots: [group.plots[0]] }).error?.issues[0].message).toBe("chooseTwoMembers");
    const twice = groupBookingSchema.safeParse({ ...group, plots: [group.plots[0], group.plots[0]] });
    expect(twice.error?.issues[0].message).toBe("memberTwice");
  });

  it("needs a machine type and a land size above 0", () => {
    expect(groupBookingSchema.safeParse({ ...group, machineTypeId: "" }).error?.issues[0].message).toBe("chooseMachineType");
    const zeroLand = groupBookingSchema.safeParse({ ...group, plots: [{ ...group.plots[0], amount: 0 }, group.plots[1]] });
    expect(zeroLand.error?.issues[0].path).toEqual(["plots", 0, "amount"]);
  });

  it("refuses a day in the past", () => {
    expect(groupBookingSchema.safeParse({ ...group, day: addDays(tomorrow, -3) }).success).toBe(false);
  });
});
