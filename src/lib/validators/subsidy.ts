// Zod rules for subsidies. The same rules run in the browser and on the server.
//   subsidyApplicationSchema — the farmer applies to a program (with an optional message)
//   subsidyProgramSchema     — the government creates or changes a program
// (The officer's approve / reject uses approvalDecisionSchema from validators/approval.ts.)
import { z } from "zod";
import { DAY_REGEX } from "@/lib/services/calendar";

/** The farmer's message to the officer (may be empty). */
export const subsidyApplicationSchema = z.object({
  note: z.string().trim().max(300, "tooLong"),
});

export type SubsidyApplicationInput = z.infer<typeof subsidyApplicationSchema>;

/** The biggest discount a program may give: half of the work charge. */
export const MAX_DISCOUNT_PERCENT = 50;

export const subsidyProgramSchema = z
  .object({
    name: z.string().trim().min(3, "required").max(100, "tooLong"),
    nameBn: z.string().trim().min(3, "required").max(100, "tooLong"),
    description: z.string().trim().max(300, "tooLong"),
    discountPercent: z
      .number("numberInvalid")
      .int("numberInvalid")
      .min(1, "discountInvalid")
      .max(MAX_DISCOUNT_PERCENT, "discountInvalid"),
    // Only farmers with this much land or less may apply. Empty box = any farmer.
    maxLandDecimal: z.number("numberInvalid").positive("numberInvalid").max(10000, "numberInvalid").optional(),
    budget: z.number("numberInvalid").int("wholeTaka").min(1000, "budgetInvalid").max(1_000_000_000, "budgetInvalid"),
    startDay: z.string().regex(DAY_REGEX, "dateInvalid"), // "2026-07-01"
    endDay: z.string().regex(DAY_REGEX, "dateInvalid"),
    isActive: z.boolean(),
  })
  // "YYYY-MM-DD" text sorts like dates, so we can compare days with >=
  .refine((program) => program.endDay >= program.startDay, {
    message: "endBeforeStart",
    path: ["endDay"],
  });

export type SubsidyProgramInput = z.infer<typeof subsidyProgramSchema>;
