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
import { BookingProblem } from "@/lib/services/booking";
import { createNotification } from "@/lib/services/notification";
import { getGateway } from "@/lib/services/payment-gateway";
import { refundMessage } from "@/lib/services/payment-messages";
import { getRefundableAmount } from "@/lib/services/payment-rules";
import type { RefundInput } from "@/lib/validators/payment";
import type { ActionResult } from "@/lib/validators/types";

/**
 * Step 1: saves a PENDING refund, after checking the payment can still give back that much.
 * Throws a BookingProblem (an expected problem) if it cannot; then nothing is saved.
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
      throw new BookingProblem("notFound");
    }
    if (payment.status !== "SUCCESS") {
      throw new BookingProblem("paymentNotRefundable");
    }
    // PENDING refunds count too, so the same money cannot be given back twice.
    if (input.amount > getRefundableAmount(payment.amount, payment.refunds)) {
      throw new BookingProblem("refundTooMuch");
    }

    const refund = await tx.refund.create({
      data: { bookingId: payment.bookingId, paymentId, amount: input.amount, reason: input.reason, status: "PENDING" },
    });
    return { refund, payment };
  });
}

/**
 * An admin gives back (part of) a successful payment. See the steps at the top of this file.
 * Returns { ok: true }, or an error key (e.g. "refundTooMuch", "refundFailed").
 */
export async function refundPayment(paymentId: string, adminId: string, input: RefundInput): Promise<ActionResult> {
  // 1. Save it as PENDING (or stop with an expected problem).
  let saved;
  try {
    saved = await savePendingRefund(paymentId, input);
  } catch (error) {
    if (error instanceof BookingProblem) {
      return { ok: false, error: error.key };
    }
    throw error;
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
