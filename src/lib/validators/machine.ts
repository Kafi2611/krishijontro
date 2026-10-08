// Zod rules for the provider's "add / edit machine" form.
// The same rules run in the browser (fast error messages) and on the server.
// Error messages are keys of the "Validation" section in messages/*.json.
import { z } from "zod";
import { BANGLADESH_BOUNDS } from "@/lib/services/geo";
import { MAX_MACHINE_PHOTOS, uploadedImageUrlSchema } from "@/lib/validators/upload";

/** The oldest machine year we accept. */
export const OLDEST_MACHINE_YEAR = 1980;

const thisYear = new Date().getFullYear();

export const machineSchema = z.object({
  machineTypeId: z.string().min(1, "required"),
  brand: z.string().trim().min(1, "required").max(40, "tooLong"),
  model: z.string().trim().min(1, "required").max(40, "tooLong"),
  year: z
    .number("numberInvalid")
    .int("numberInvalid")
    .min(OLDEST_MACHINE_YEAR, "yearInvalid")
    .max(thisYear, "yearInvalid"),
  horsePower: z.number("numberInvalid").int("numberInvalid").min(1, "numberInvalid").max(500, "numberInvalid").optional(),
  // Empty means "no registration number" (small machines like pumps have none).
  registrationNo: z.string().trim().toUpperCase().max(30, "tooLong"),
  description: z.string().trim().max(500, "tooLong"),
  // Taka per acre / hour / day. The government min–max check happens in the form and on the server.
  rate: z.number("numberInvalid").int("wholeTaka").min(1, "numberInvalid"),
  locationId: z.string().min(1, "required"), // the upazila where the machine is kept
  address: z.string().trim().max(120, "tooLong"),
  lat: z
    .number("pickOnMap")
    .min(BANGLADESH_BOUNDS.minLat, "outsideBangladesh")
    .max(BANGLADESH_BOUNDS.maxLat, "outsideBangladesh"),
  lng: z
    .number("pickOnMap")
    .min(BANGLADESH_BOUNDS.minLng, "outsideBangladesh")
    .max(BANGLADESH_BOUNDS.maxLng, "outsideBangladesh"),
  engineHours: z.number("numberInvalid").min(0, "numberInvalid").max(100000, "numberInvalid"),
  serviceDueHours: z.number("numberInvalid").min(1, "numberInvalid").max(100000, "numberInvalid"),
  imageUrls: z.array(uploadedImageUrlSchema).max(MAX_MACHINE_PHOTOS, "tooManyPhotos"),
});

export type MachineInput = z.infer<typeof machineSchema>;
