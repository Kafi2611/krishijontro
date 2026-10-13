// Zod rules for the government's "price limit" form (one machine type at a time).
// The same rules run in the browser (fast error messages) and again on the server.
import { z } from "zod";
import { DAY_REGEX } from "@/lib/services/calendar";

/** The highest extra % the government may allow in the harvest season. */
export const MAX_SEASON_CAP_PERCENT = 50;

/** A day like "2026-11-01", or "" when the box is left empty. */
const optionalDay = z.union([z.literal(""), z.string().regex(DAY_REGEX, "dateInvalid")]);

/** A whole-taka amount from 1 to 100,000. */
const takaAmount = z.number("numberInvalid").int("wholeTaka").min(1, "numberInvalid").max(100000, "numberInvalid");

export const pricingRuleSchema = z
  .object({
    minRate: takaAmount, // lowest rate a provider may set
    maxRate: takaAmount, // highest rate a provider may set
    seasonCapPercent: z
      .number("numberInvalid")
      .int("numberInvalid")
      .min(0, "percentInvalid")
      .max(MAX_SEASON_CAP_PERCENT, "percentInvalid"),
    harvestSeasonStart: optionalDay, // leave both season days empty for "no harvest season"
    harvestSeasonEnd: optionalDay,
    deliveryRatePerKm: z.number("numberInvalid").int("wholeTaka").min(0, "numberInvalid").max(1000, "numberInvalid"),
    freeKm: z.number("numberInvalid").min(0, "numberInvalid").max(50, "numberInvalid"),
    minCharge: z.number("numberInvalid").min(0, "numberInvalid").max(100, "numberInvalid"), // acres, hours or days
  })
  .refine((rule) => rule.maxRate >= rule.minRate, {
    message: "maxBelowMin",
    path: ["maxRate"], // show the error under the "highest rate" box
  })
  // Either both season days are filled, or both are empty.
  .refine((rule) => (rule.harvestSeasonStart === "") === (rule.harvestSeasonEnd === ""), {
    message: "seasonDatesBoth",
    path: ["harvestSeasonEnd"],
  })
  // When both are filled, the season must not end before it starts.
  // ("YYYY-MM-DD" text sorts like dates, so we can compare it with >=)
  .refine((rule) => {
    const bothFilled = rule.harvestSeasonStart !== "" && rule.harvestSeasonEnd !== "";
    return !bothFilled || rule.harvestSeasonEnd >= rule.harvestSeasonStart;
  }, {
    message: "endBeforeStart",
    path: ["harvestSeasonEnd"],
  });

export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;
