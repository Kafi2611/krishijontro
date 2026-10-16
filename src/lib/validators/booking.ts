// Zod rules for the booking forms. The same rules run in the browser (the forms) and on
// the server (the server actions), so nobody gets past a rule by skipping the form.
//   bookingSchema       — the farmer's 3-step booking form
//   rejectBookingSchema — the provider's reason for saying no
//   assignOperatorSchema — the provider picks an operator
//   startWorkSchema / finishWorkSchema — the operator types the farmer's OTP (and the real work done)
import { z } from "zod";
import { getJobStartAt, isStartFarEnough, START_HOURS } from "@/lib/services/booking-rules";
import { addDays, toDhakaDay } from "@/lib/services/calendar";
import { MAX_DAYS_AHEAD, machineSearchSchema } from "@/lib/validators/search";

// The booking form asks some of the same questions as the search (work, land, day, field),
// so it reuses exactly the same rules for them.
const searchFields = machineSearchSchema.shape;

export const bookingSchema = z
  .object({
    machineId: z.string().min(1, "somethingWrong"),
    // Step 1: the job
    workType: searchFields.workType,
    landValue: searchFields.landValue,
    landUnit: searchFields.landUnit,
    hoursOrDays: searchFields.hoursOrDays, // only for machines rented per hour / day
    lat: searchFields.lat,
    lng: searchFields.lng,
    fieldAddress: z.string().trim().max(120, "tooLong"), // e.g. "North field, next to the pond"
    // Step 2: the day and the start time
    day: searchFields.day,
    startHour: z.number("chooseStartTime").refine((hour) => START_HOURS.includes(hour), "chooseStartTime"),
    // Step 3: a message for the provider
    note: z.string().trim().max(300, "tooLong"),
  })
  // "YYYY-MM-DD" text sorts like dates, so we can compare days with <=
  .refine((booking) => booking.day <= addDays(toDhakaDay(new Date()), MAX_DAYS_AHEAD), {
    message: "dayTooFar",
    path: ["day"],
  })
  // This also refuses a day in the past (it is never "far enough" ahead).
  .refine((booking) => isStartFarEnough(getJobStartAt(booking.day, booking.startHour)), {
    message: "startTooSoon",
    path: ["startHour"],
  });

export type BookingInput = z.infer<typeof bookingSchema>;

/** The provider says no: the farmer must be told why (at least 3 letters). */
export const rejectBookingSchema = z.object({
  reason: z.string().trim().min(3, "reasonRequired").max(200, "tooLong"),
});

export type RejectBookingInput = z.infer<typeof rejectBookingSchema>;

/** The provider picks one of their operators for a booking. */
export const assignOperatorSchema = z.object({
  operatorId: z.string().min(1, "chooseOperator"),
});

export type AssignOperatorInput = z.infer<typeof assignOperatorSchema>;

/** The farmer's 4-digit code. (The form has already turned Bangla digits into English digits.) */
const otpField = z.string().trim().regex(/^\d{4}$/, "otpInvalid");

/** The operator starts the work with the farmer's start code. */
export const startWorkSchema = z.object({
  otp: otpField,
});

export type StartWorkInput = z.infer<typeof startWorkSchema>;

/** The operator finishes the work: the real amount of work, and the farmer's finish code. */
export const finishWorkSchema = z.object({
  // Decimal of land for machines rented per acre, otherwise hours or days.
  actualValue: z.number("numberInvalid").positive("numberInvalid").max(10000, "numberInvalid"),
  otp: otpField,
});

export type FinishWorkInput = z.infer<typeof finishWorkSchema>;
