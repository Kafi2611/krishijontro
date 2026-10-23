"use server";
// Server actions for money: paying (farmer), "cash received" (operator / provider),
// refunds and payouts (admin). Each one first checks ON THE SERVER that the user has the
// right role, checks the form again with the same Zod rules as the browser, then calls the
// service with the user's own id (so nobody can act for someone else).
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { finishMockPayment, recordCashPayment, startOnlinePayment, type StartPaymentResult } from "@/lib/services/payment";
import { createPayout } from "@/lib/services/payout";
import { refundPayment } from "@/lib/services/refund";
import {
  mockOutcomeSchema,
  payoutSchema,
  refundSchema,
  type PayoutInput,
  type RefundInput,
} from "@/lib/validators/payment";
import type { ActionResult } from "@/lib/validators/types";

/** After a successful change, every page is drawn again with the new amounts and statuses. */
function refreshPagesIfDone(result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

// ─────────────────────────── Farmer ───────────────────────────

/** "Pay online": returns the gateway page to open, or an error key. */
export async function startOnlinePaymentAction(bookingId: string): Promise<StartPaymentResult> {
  const farmer = await requireRole("FARMER");
  const locale = await getLocale(); // so the farmer comes back to a page in their language
  return startOnlinePayment(bookingId, farmer, locale);
}

/** A button on the pretend bank page: pay, fail or cancel. */
export async function finishMockPaymentAction(transactionId: string, outcome: string): Promise<ActionResult> {
  const farmer = await requireRole("FARMER");
  const parsed = mockOutcomeSchema.safeParse(outcome);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await finishMockPayment(transactionId, farmer.id, parsed.data));
}

// ─────────────────────────── Operator / provider ───────────────────────────

/** "Cash received": the booking's operator or its machine's provider took the farmer's cash. */
export async function recordCashPaymentAction(bookingId: string): Promise<ActionResult> {
  const receiver = await requireRole("OPERATOR", "PROVIDER");
  return refreshPagesIfDone(await recordCashPayment(bookingId, receiver.id));
}

// ─────────────────────────── Admin ───────────────────────────

/** Gives back (part of) a successful payment. */
export async function refundPaymentAction(paymentId: string, values: RefundInput): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = refundSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await refundPayment(paymentId, admin.id, parsed.data));
}

/** Records that the admin has sent a provider all the money owed to them. */
export async function createPayoutAction(providerId: string, values: PayoutInput): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = payoutSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "referenceRequired" };
  }
  return refreshPagesIfDone(await createPayout(providerId, admin.id, parsed.data.reference));
}
