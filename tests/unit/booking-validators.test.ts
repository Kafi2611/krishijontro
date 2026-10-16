// Unit tests for the booking form rules in src/lib/validators/booking.ts.
// The booking rules compare with "now", so every test freezes the clock at
// 20 October 2026, 6:00 AM in Dhaka (00:00 UTC).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookingSchema,
  finishWorkSchema,
  rejectBookingSchema,
  startWorkSchema,
  type BookingInput,
} from "@/lib/validators/booking";

/** A correct booking: 66 decimal of tilling near Paba, tomorrow at 8 AM. */
const validBooking: BookingInput = {
  machineId: "machine-1",
  workType: "TILLING",
  landValue: 66,
  landUnit: "DECIMAL",
  hoursOrDays: 2,
  lat: 24.42,
  lng: 88.6,
  fieldAddress: "North field, next to the pond",
  day: "2026-10-21",
  startHour: 8,
  note: "",
};

/** The error keys Zod gives for a booking (empty list = the booking is fine). */
function errorKeys(booking: BookingInput): string[] {
  const result = bookingSchema.safeParse(booking);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("bookingSchema", () => {
  it("accepts a correct booking", () => {
    expect(errorKeys(validBooking)).toEqual([]);
  });

  it("accepts today when the start is at least 2 hours away", () => {
    // Now is 6 AM, so 8 AM today is exactly 2 hours away.
    expect(errorKeys({ ...validBooking, day: "2026-10-20", startHour: 8 })).toEqual([]);
  });

  it("refuses a start less than 2 hours away, or in the past", () => {
    expect(errorKeys({ ...validBooking, day: "2026-10-20", startHour: 7 })).toEqual(["startTooSoon"]);
    expect(errorKeys({ ...validBooking, day: "2026-10-19" })).toEqual(["startTooSoon"]);
  });

  it("refuses a day more than 60 days ahead", () => {
    expect(errorKeys({ ...validBooking, day: "2026-12-20" })).toEqual(["dayTooFar"]);
  });

  it("only allows the start times on the list (6 AM to 5 PM)", () => {
    expect(errorKeys({ ...validBooking, startHour: 22 })).toContain("chooseStartTime");
    expect(errorKeys({ ...validBooking, startHour: 8.5 })).toContain("chooseStartTime");
  });

  it("refuses a field outside Bangladesh and a land size of 0", () => {
    expect(errorKeys({ ...validBooking, lat: 0, lng: 0 })).toEqual(["outsideBangladesh", "outsideBangladesh"]);
    expect(errorKeys({ ...validBooking, landValue: 0 })).toEqual(["numberInvalid"]);
  });

  it("refuses a very long field address or note", () => {
    expect(errorKeys({ ...validBooking, fieldAddress: "x".repeat(121) })).toEqual(["tooLong"]);
    expect(errorKeys({ ...validBooking, note: "x".repeat(301) })).toEqual(["tooLong"]);
  });
});

describe("OTP forms", () => {
  it("needs exactly 4 digits", () => {
    expect(startWorkSchema.safeParse({ otp: "0427" }).success).toBe(true);
    expect(startWorkSchema.safeParse({ otp: "427" }).success).toBe(false);
    expect(startWorkSchema.safeParse({ otp: "12345" }).success).toBe(false);
    expect(startWorkSchema.safeParse({ otp: "12a4" }).success).toBe(false);
  });

  it("needs a real amount of work above 0 to finish", () => {
    expect(finishWorkSchema.safeParse({ actualValue: 70, otp: "5089" }).success).toBe(true);
    expect(finishWorkSchema.safeParse({ actualValue: 0, otp: "5089" }).success).toBe(false);
  });
});

describe("rejectBookingSchema", () => {
  it("needs a reason of at least 3 letters", () => {
    expect(rejectBookingSchema.safeParse({ reason: "Machine busy" }).success).toBe(true);
    expect(rejectBookingSchema.safeParse({ reason: "  no " }).success).toBe(false);
  });
});
