// Zod rules for the farmer's "NID and land" form. The agriculture officer of the farmer's
// upazila checks these details before the farmer can get a subsidy.
// The same rules run in the browser (the form) and on the server (the server action).
import { z } from "zod";
import { LAND_UNITS } from "@/lib/services/geo";
import { NID_REGEX } from "@/lib/validators/provider";

export const farmerDetailsSchema = z.object({
  nid: z.string().trim().regex(NID_REGEX, "nidInvalid"),
  // All the land the farmer farms, in decimal, bigha or acre (saved as decimal).
  landValue: z.number("numberInvalid").positive("numberInvalid").max(10000, "numberInvalid"),
  landUnit: z.enum(LAND_UNITS),
  village: z.string().trim().min(2, "required").max(60, "tooLong"),
  locationId: z.string().min(1, "required"), // the farmer's upazila (decides which officer checks)
});

export type FarmerDetailsInput = z.infer<typeof farmerDetailsSchema>;
