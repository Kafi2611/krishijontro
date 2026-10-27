// Zod rules for the farmer's review form. The same rules run in the browser and on the server.
// The farmer rates the machine and the operator separately, 1 to 5 stars each, with an
// optional comment for each.
import { z } from "zod";

/** 1 to 5 whole stars. */
const starsField = z.number("ratingRequired").int("ratingRequired").min(1, "ratingRequired").max(5, "ratingRequired");

export const reviewSchema = z.object({
  machineRating: starsField,
  machineComment: z.string().trim().max(300, "tooLong"),
  operatorRating: starsField,
  operatorComment: z.string().trim().max(300, "tooLong"),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
