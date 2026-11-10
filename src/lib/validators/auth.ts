// Zod rules for the login and register forms.
// The SAME rules run in the browser (to show errors fast) and on the server
// (because a browser can be tricked, the server must check again).
// Error messages are translation keys from the "Validation" section of messages/*.json.
import { z } from "zod";

/** Bangladesh mobile number: 11 digits, starts with 013–019. Example: 01712345678 */
export const PHONE_REGEX = /^01[3-9]\d{8}$/;

export const phoneSchema = z.string().trim().regex(PHONE_REGEX, "phoneInvalid");

/** The shortest password a new account may have (register, new operator, new staff account). */
export const MIN_PASSWORD_LENGTH = 8;

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "required"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "nameRequired").max(80, "nameTooLong"),
    phone: phoneSchema,
    // At least 8 characters for a NEW account (a short password is easy to guess).
    // bcrypt only reads the first 72 characters, so we do not allow longer passwords.
    // (Logging in accepts any length, so accounts made earlier keep working.)
    password: z.string().min(MIN_PASSWORD_LENGTH, "passwordShort").max(72, "passwordLong"),
    confirmPassword: z.string().min(1, "required"),
    role: z.enum(["FARMER", "PROVIDER"], "required"),
    providerType: z.enum(["INDIVIDUAL", "COOPERATIVE", "COMPANY"]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwordsDontMatch",
    path: ["confirmPassword"], // show the error under the "confirm password" box
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
