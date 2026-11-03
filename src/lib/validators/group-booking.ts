// Zod rules for the cooperative leader's group booking form (one machine, many members' plots).
// The same rules run in the browser (the form) and on the server (the server actions).
//   Step 1 — the job: the work, the machine type, the day and start time, the village pin, how far
//   Step 2 — the plots: at least 2 members, each with their land (or hours / days) and a short note
//   Step 3 — the machine (machineId is "" until the leader picks one from the list)
import { z } from "zod";
import { WorkType } from "@/generated/prisma/enums";
import { getJobStartAt, isStartFarEnough, START_HOURS } from "@/lib/services/booking-rules";
import { addDays, toDhakaDay } from "@/lib/services/calendar";
import { MAX_DAYS_AHEAD, machineSearchSchema } from "@/lib/validators/search";

/** A group booking is for at least 2 and at most 12 plots (one machine cannot do more in a row). */
export const MIN_GROUP_PLOTS = 2;
export const MAX_GROUP_PLOTS = 12;

// The same rules as the farmer's search for the day and the map pin.
const searchFields = machineSearchSchema.shape;

/** One member's plot. */
export const groupPlotSchema = z.object({
  farmerId: z.string().min(1, "somethingWrong"),
  // Decimal of land for machines rented per acre, otherwise hours or days.
  amount: z.number("numberInvalid").positive("numberInvalid").max(10000, "numberInvalid"),
  plotNote: z.string().trim().max(80, "tooLong"), // e.g. "North of the pond"
});

export const groupBookingSchema = z
  .object({
    workType: z.enum(WorkType, "required"),
    machineTypeId: z.string().min(1, "chooseMachineType"),
    day: searchFields.day,
    startHour: z.number("chooseStartTime").refine((hour) => START_HOURS.includes(hour), "chooseStartTime"),
    lat: searchFields.lat,
    lng: searchFields.lng,
    maxKm: searchFields.maxKm,
    plots: z.array(groupPlotSchema).min(MIN_GROUP_PLOTS, "chooseTwoMembers").max(MAX_GROUP_PLOTS, "tooManyPlots"),
    machineId: z.string(), // "" while searching; the chosen machine when booking
  })
  // "YYYY-MM-DD" text sorts like dates, so we can compare days with <=
  .refine((group) => group.day <= addDays(toDhakaDay(new Date()), MAX_DAYS_AHEAD), {
    message: "dayTooFar",
    path: ["day"],
  })
  // This also refuses a day in the past (it is never "far enough" ahead).
  .refine((group) => isStartFarEnough(getJobStartAt(group.day, group.startHour)), {
    message: "startTooSoon",
    path: ["startHour"],
  })
  // Each member only once: one plot per member in one group booking.
  .refine((group) => new Set(group.plots.map((plot) => plot.farmerId)).size === group.plots.length, {
    message: "memberTwice",
    path: ["plots"],
  });

export type GroupBookingInput = z.infer<typeof groupBookingSchema>;
