/**
 * Refund service — giving money back to a farmer.
 *
 * In this phase an admin gives a refund from the Payments page, for one successful payment.
 * (Phase 6 and 7 use the same function for breakdowns and complaints.)
 * The steps are made safe against two admins pressing "Refund" at the same moment:
 *   1. In a transaction: lock the payment's row, check the amount is not more than what is
 *      left (paid − refunded so far), and save the refund as PENDING.
 *   2. Online payment: ask the same gateway to send the money back.
 *      Cash payment: there is no gateway; the admin gives the money back by hand (bKash or cash).
 *   3. It worked -> the refund becomes PROCESSED, with an audit log row and a message to the farmer.
 *      The gateway said no -> the PENDING refund is removed again, so nothing has changed.
 * Refunds come out of the provider's share (see getBookingMoney in payment-rules.ts).
 */
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notification";
import { getGateway } from "@/lib/services/payment-gateway";
import { refundMessage } from "@/lib/services/payment-messages";
import { getRefundableAmount } from "@/lib/services/payment-rules";
import type { RefundInput } from "@/lib/validators/payment";
import type { ActionResult } from "@/lib/validators/types";

/**
 * Step 1: saves a PENDING refund, after checking the payment can still give back that much.
 * Returns the refund and its payment, or an error key (then nothing was saved: every check
 * comes before the only write). "as const" tells TypeScript that ok is exactly true or false,
 * so after "if (!saved.ok)" it knows which of the two answers it has.
 */
async function savePendingRefund(paymentId: string, input: RefundInput) {
  return db.$transaction(async (tx) => {
    // Lock the payment: a second admin's refund waits here until this one is saved,
    // so it sees this refund when it adds up what was already given back.
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true, booking: { select: { id: true, code: true, farmerId: true } } },
    });
    if (!payment) {
      return { ok: false, error: "notFound" } as const;
    }
    if (payment.status !== "SUCCESS") {
      return { ok: false, error: "paymentNotRefundable" } as const;
    }
    // PENDING refunds count too, so the same money cannot be given back twice.
    if (input.amount > getRefundableAmount(payment.amount, payment.refunds)) {
      return { ok: false, error: "refundTooMuch" } as const;
    }

    const refund = await tx.refund.create({
      data: { bookingId: payment.bookingId, paymentId, amount: input.amount, reason: input.reason, status: "PENDING" },
    });
    return { ok: true, refund, payment } as const;
  });
}

/**
 * An admin gives back (part of) a successful payment. See the steps at the top of this file.
 * Returns { ok: true }, or an error key (e.g. "refundTooMuch", "refundFailed").
 */
export async function refundPayment(paymentId: string, adminId: string, input: RefundInput): Promise<ActionResult> {
  // 1. Save it as PENDING (or stop, if it cannot give back that much).
  const saved = await savePendingRefund(paymentId, input);
  if (!saved.ok) {
    return saved;
  }
  const { refund, payment } = saved;

  // 2. Online: the gateway sends the money back. Cash: the admin hands it back.
  if (payment.method !== "CASH") {
    const result = await getGateway(payment.method).refund({
      refundId: refund.id,
      gatewayRef: payment.gatewayRef,
      amount: refund.amount,
      reason: refund.reason,
    });
    if (!result.ok) {
      await db.refund.delete({ where: { id: refund.id } });
      return { ok: false, error: "refundFailed" };
    }
  }

  // 3. Done: PROCESSED, audit log and a message to the farmer, all saved together.
  await db.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: refund.id }, data: { status: "PROCESSED", processedAt: new Date() } });
    await writeAuditLog(
      {
        actorId: adminId,
        action: "REFUND_PROCESSED",
        entityType: "Refund",
        entityId: refund.id,
        details: `Refunded ${refund.amount} Tk of ${payment.booking.code} (${payment.method}): ${refund.reason}`,
      },
      tx,
    );
    await createNotification(
      { userId: payment.booking.farmerId, channel: "SMS", ...refundMessage(payment.booking, refund.amount, payment.method, refund.reason) },
      tx,
    );
  });
  return { ok: true };
}
