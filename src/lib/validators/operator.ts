// Zod rules for the provider's "Add operator" form.
// The provider creates the operator's account, so the provider also sets the
// first password and tells it to the operator.
import { z } from "zod";
import { phoneSchema } from "@/lib/validators/auth";

export const operatorSchema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(80, "nameTooLong"),
  phone: phoneSchema,
  // bcrypt only reads the first 72 characters, so longer passwords are not allowed
  password: z.string().min(6, "passwordShort").max(72, "passwordLong"),
  licenseNo: z.string().trim().max(30, "tooLong"), // driving licence, optional
  experienceYears: z.number("numberInvalid").int("numberInvalid").min(0, "numberInvalid").max(50, "numberInvalid"),
});

export type OperatorInput = z.infer<typeof operatorSchema>;
