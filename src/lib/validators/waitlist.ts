// Zod rules for joining the waitlist. The same rules run in the browser and on the server.
// The farmer joins from the search page when no machine is free, so the fields are the
// search's own fields (work, land, field, day) plus the machine type they wait for.
import { z } from "zod";
import { addDays, toDhakaDay } from "@/lib/services/calendar";
import { MAX_DAYS_AHEAD, machineSearchSchema } from "@/lib/validators/search";

const searchFields = machineSearchSchema.shape;

export const joinWaitlistSchema = z
  .object({
    machineTypeId: z.string().min(1, "required"),
    workType: searchFields.workType,
    landValue: searchFields.landValue,
    landUnit: searchFields.landUnit,
    lat: searchFields.lat,
    lng: searchFields.lng,
    day: searchFields.day, // the day the farmer wants the work done
  })
  // The same day rules as the search: not in the past, and not too far ahead.
  // ("YYYY-MM-DD" text sorts like dates, so we can compare days with >= and <=)
  .refine((entry) => entry.day >= toDhakaDay(new Date()), { message: "dayInPast", path: ["day"] })
  .refine((entry) => entry.day <= addDays(toDhakaDay(new Date()), MAX_DAYS_AHEAD), { message: "dayTooFar", path: ["day"] });

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
