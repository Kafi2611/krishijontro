// Zod rules for the admin's Users page: suspending or activating an account.
// The same rules run in the browser (the form) and on the server (the server action).
import { z } from "zod";

/** Suspend (a reason is needed, the user is told) or activate again (no reason needed). */
export const userStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    reason: z.string().trim().max(200, "tooLong"),
  })
  .refine((input) => input.status === "ACTIVE" || input.reason.length >= 3, {
    message: "reasonRequired",
    path: ["reason"],
  });

export type UserStatusInput = z.infer<typeof userStatusSchema>;
