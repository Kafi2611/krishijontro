// Zod rules for the operator's "Report a breakdown" form. The same rules run in the browser and
// on the server. (The server also checks the work done is less than what was booked.)
import { z } from "zod";
import { UPLOADED_IMAGE_URL_REGEX } from "@/lib/validators/upload";

/** At most one photo of the broken machine. */
export const MAX_BREAKDOWN_PHOTOS = 1;

export const breakdownSchema = z.object({
  // The work done before the breakdown: decimal of land for machines rented per acre,
  // otherwise hours or days. 0 is allowed (it broke down at once).
  doneAmount: z.number("numberInvalid").min(0, "numberInvalid").max(10000, "numberInvalid"),
  description: z.string().trim().min(5, "describeProblem").max(300, "tooLong"), // what is wrong
  photoUrls: z.array(z.string().regex(UPLOADED_IMAGE_URL_REGEX, "uploadFailed")).max(MAX_BREAKDOWN_PHOTOS, "tooManyPhotos"),
});

export type BreakdownInput = z.infer<typeof breakdownSchema>;
