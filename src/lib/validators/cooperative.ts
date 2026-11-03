// Zod rules for the cooperative leader's forms:
//   cooperativeSchema — the cooperative's details (name, upazila, village, registration number)
//   addMemberSchema   — add a member farmer by their mobile number
// The same rules run in the browser (the forms) and on the server (the server actions).
import { z } from "zod";
import { phoneSchema } from "@/lib/validators/auth";

export const cooperativeSchema = z.object({
  name: z.string().trim().min(3, "nameRequired").max(100, "tooLong"),
  upazilaId: z.string().min(1, "chooseUpazila"),
  village: z.string().trim().min(2, "required").max(60, "tooLong"),
  registrationNo: z.string().trim().max(30, "tooLong"), // optional, e.g. "COOP-RAJ-0457"
});

export type CooperativeInput = z.infer<typeof cooperativeSchema>;

export const addMemberSchema = z.object({
  phone: phoneSchema,
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
