// Zod rules for joining the waitlist. The same rules run in the browser and on the server.
// The farmer joins from the search page when no machine is free, so the fields are the
// search's own fields (work, land, field, day) plus the machine type they wait for.
import { z } from "zod";
import { machineSearchSchema } from "@/lib/validators/search";

const searchFields = machineSearchSchema.shape;

export const joinWaitlistSchema = z.object({
  machineTypeId: z.string().min(1, "required"),
  workType: searchFields.workType,
  landValue: searchFields.landValue,
  landUnit: searchFields.landUnit,
  lat: searchFields.lat,
  lng: searchFields.lng,
  day: searchFields.day, // the day the farmer wants the work done
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
