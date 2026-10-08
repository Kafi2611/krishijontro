// Zod rules for the admin's approve / reject decision.
// Approving needs nothing more; rejecting needs a short reason, because the
// provider must know what to fix.
import { z } from "zod";

/** What the admin can approve: a provider account, a machine or an operator account. */
export const APPROVAL_TARGETS = ["providers", "machines", "operators"] as const;
export type ApprovalTarget = (typeof APPROVAL_TARGETS)[number];

export const approvalDecisionSchema = z
  .object({
    approve: z.boolean(),
    reason: z.string().trim().max(200, "tooLong"),
  })
  .refine((decision) => decision.approve || decision.reason.length >= 3, {
    message: "reasonRequired",
    path: ["reason"],
  });

export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
