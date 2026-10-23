// Zod rules for the money forms. The same rules run in the browser and on the server.
//   refundSchema — the admin gives (part of) a payment back
//   payoutSchema — the admin has sent a provider their money
//   mockOutcomeSchema — the button pressed on the pretend bank page
import { z } from "zod";

/** The admin's refund: a whole-taka amount and the reason (the farmer sees it). */
export const refundSchema = z.object({
  amount: z.number("numberInvalid").int("wholeTaka").min(1, "numberInvalid").max(1_000_000, "numberInvalid"),
  reason: z.string().trim().min(3, "reasonRequired").max(200, "tooLong"),
});

export type RefundInput = z.infer<typeof refundSchema>;

/** The reference of the admin's transfer to the provider, e.g. "bKash TRX 9KJ27XQ1". */
export const payoutSchema = z.object({
  reference: z.string().trim().min(4, "referenceRequired").max(60, "tooLong"),
});

export type PayoutInput = z.infer<typeof payoutSchema>;

/** Pay, fail or cancel on the pretend bank page (see MockGateway). */
export const mockOutcomeSchema = z.enum(["pay", "fail", "cancel"]);
