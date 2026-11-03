// Zod rules for complaints ("disputes"):
//   complaintSchema — the farmer's "Report a problem" form: a reason and what happened
//   decisionSchema  — the admin's decision: refund / fine / no action, the amount, and a note
// The same rules run in the browser (the forms) and on the server (the server actions).
// The service (lib/services/dispute.ts) checks the amounts against the booking too, e.g. that
// a refund is not more than what was paid.
import { z } from "zod";
import { DISPUTE_REASONS } from "@/lib/services/dispute-rules";

export const complaintSchema = z.object({
  reason: z.enum(DISPUTE_REASONS, "chooseReason"),
  description: z.string().trim().min(5, "describeProblem").max(500, "tooLong"),
});

export type ComplaintInput = z.infer<typeof complaintSchema>;

export const decisionSchema = z
  .object({
    decision: z.enum(["REFUND", "PENALTY", "NO_ACTION"]),
    // Whole taka: the money to give back (a paid booking) or the fine. 0 when not used.
    amountTk: z.number("numberInvalid").int("wholeTaka").min(0, "numberInvalid").max(1_000_000, "numberInvalid"),
    // A booking not paid yet: the right amount of work (decimal of land for machines rented per
    // acre, otherwise hours or days). The bill is worked out again from it. 0 when not used.
    correctedWork: z.number("numberInvalid").min(0, "numberInvalid").max(10000, "numberInvalid"),
    // Both the farmer and the provider read this note.
    note: z.string().trim().min(3, "reasonRequired").max(300, "tooLong"),
  })
  // A fine needs an amount.
  .refine((input) => input.decision !== "PENALTY" || input.amountTk >= 1, {
    message: "amountRequired",
    path: ["amountTk"],
  })
  // A refund needs money to give back, or the corrected work for a lower bill.
  .refine((input) => input.decision !== "REFUND" || input.amountTk >= 1 || input.correctedWork > 0, {
    message: "amountRequired",
    path: ["amountTk"],
  });

export type DecisionInput = z.infer<typeof decisionSchema>;
