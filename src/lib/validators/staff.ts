// Zod rules for the admin's "Add a staff account" form.
// Farmers and providers sign up themselves, and providers add their own operators, so the
// admin only makes the other ("staff") accounts. The admin sets the first password and tells
// it to the person. The same rules run in the browser (the form) and on the server.
import { z } from "zod";
import { phoneSchema } from "@/lib/validators/auth";

/** The roles the admin can make an account for. */
export const STAFF_ROLES = ["COOP_LEADER", "TECHNICIAN", "OFFICER", "GOVT", "ADMIN"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const staffSchema = z
  .object({
    role: z.enum(STAFF_ROLES, "required"),
    name: z.string().trim().min(2, "nameRequired").max(80, "nameTooLong"),
    phone: phoneSchema,
    // bcrypt only reads the first 72 characters, so longer passwords are not allowed
    password: z.string().min(6, "passwordShort").max(72, "passwordLong"),
    upazilaId: z.string(), // an officer's upazila (needed), or where a technician works (may be empty)
    designation: z.string().trim().max(60, "tooLong"), // officer only, e.g. "Upazila Agriculture Officer"
    skills: z.string().trim().max(100, "tooLong"), // technician only, e.g. "Engine, hydraulics"
  })
  // An officer decides the farmers of ONE upazila, so their upazila must be chosen.
  .refine((staff) => staff.role !== "OFFICER" || staff.upazilaId !== "", {
    message: "chooseUpazila",
    path: ["upazilaId"],
  });

export type StaffInput = z.infer<typeof staffSchema>;
