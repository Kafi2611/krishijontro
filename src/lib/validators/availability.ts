// Zod rules for the "block days" form on the availability calendar.
import { z } from "zod";
import { DAY_REGEX } from "@/lib/services/calendar";

export const availabilityBlockSchema = z
  .object({
    fromDay: z.string().regex(DAY_REGEX, "dateInvalid"), // "2026-10-20"
    toDay: z.string().regex(DAY_REGEX, "dateInvalid"), // the last blocked day (included)
    reason: z.string().trim().max(100, "tooLong"),
  })
  // "YYYY-MM-DD" text sorts like dates, so we can compare it with >=
  .refine((block) => block.toDay >= block.fromDay, {
    message: "endBeforeStart",
    path: ["toDay"], // show the error under the "To" box
  });

export type AvailabilityBlockInput = z.infer<typeof availabilityBlockSchema>;
