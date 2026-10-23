/**
 * Payment service — the farmer pays for a finished job.
 *
 * A booking waits for payment when its work is done (status COMPLETED). Two ways to pay:
 *   1. Online: startOnlinePayment() saves a PENDING Payment and sends the farmer to the gateway
 *      (payment-gateway.ts). When the gateway says "paid", confirmOnlinePayment() asks the
 *      gateway again to be sure, then marks the payment SUCCESS and the booking PAID.
 *      failOnlinePayment() marks a failed or cancelled try; the farmer can simply try again.
 *   2. Cash on completion: the farmer gives the cash to the operator, and the operator (or the
 *      provider) presses "Cash received" -> recordCashPayment().
 * When a booking becomes PAID (both ways, inside ONE transaction, see markBookingPaid):
 *   - its status changes through changeBookingStatus (COMPLETED -> PAID, with a history row)
 *   - its subsidy is taken from the program's budget (spendSubsidy in subsidy.ts)
 *   - the farmer and the provider get a message
 * The farmer always pays booking.totalAmount (work + delivery − subsidy).
 */
import type { Prisma } from "@/generated/prisma/client";
import type { BillingUnit, PaymentMethod, WorkType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { BookingProblem, changeBookingStatus, messageInfo, runBookingStep } from "@/lib/services/booking";
import { getProviderShare } from "@/lib/services/booking-rules";
import { createNotification, notifyAllAdmins } from "@/lib/services/notification";
import { getGateway, getOnlineGateway } from "@/lib/services/payment-gateway";
import { bookingPaidMessage, paidTwiceMessage, paymentReceivedMessage } from "@/lib/services/payment-messages";
import { canPayBooking, getRefundableAmount, makeTransactionId } from "@/lib/services/payment-rules";
import { spendSubsidy } from "@/lib/services/subsidy";
import type { ActionResult, ValidationKey } from "@/lib/validators/types";

// ─────────────────────────── Shared parts ───────────────────────────

/** The booking fields a payment needs: amounts, people, machine name, subsidy program. */
const BOOKING_FOR_PAYMENT = {
  machine: { select: { brand: true, model: true, providerId: true } },
  subsidyApplication: { select: { programId: true } },
} satisfies Prisma.BookingInclude;

type BookingForPayment = Prisma.BookingGetPayload<{ include: typeof BOOKING_FOR_PAYMENT }>;

/**
 * Locks one booking's row until the transaction ends ("FOR UPDATE"), like createBooking locks
 * the machine. A cash payment and an online payment (or two browser tabs) for the same booking
 * then happen one after the other, never both at once, so the booking is marked PAID only once.
 */
async function lockBooking(tx: Prisma.TransactionClient, bookingId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
}

/**
 * The booking becomes PAID. Call it inside the transaction that saved the payment, so both are
 * saved or neither: the status change (with its history row), the subsidy taken from the
 * program's budget, and a message to the farmer and to the provider.
 */
async function markBookingPaid(
  tx: Prisma.TransactionClient,
  booking: BookingForPayment,
  actorId: string,
  payment: { amount: number; method: PaymentMethod },
): Promise<void> {
  await changeBookingStatus(booking.id, "PAID", actorId, tx);
  await spendSubsidy(tx, booking);

  const info = messageInfo(booking);
  const share = getProviderShare(booking);
  await createNotification(
    { userId: booking.farmerId, channel: "SMS", ...paymentReceivedMessage(info, payment.amount, payment.method) },
    tx,
  );
  await createNotification(
    { userId: booking.machine.providerId, ...bookingPaidMessage(info, payment.amount, payment.method, share) },
    tx,
  );
}

// ─────────────────────────── 1. Paying online ───────────────────────────

export type StartPaymentResult = { ok: true; redirectUrl: string } | { ok: false; error: ValidationKey };

/**
 * The farmer presses "Pay online" on a finished job of THEIR OWN.
 * Saves a new PENDING payment for the booking's total, and returns the gateway page to open.
 * Each try gets a new transaction id, so a failed try never blocks the next one.
 */
export async function startOnlinePayment(
  bookingId: string,
  farmer: { id: string; name: string; phone: string },
  locale: string,
): Promise<StartPaymentResult> {
  const booking = await db.booking.findFirst({
    where: { id: bookingId, farmerId: farmer.id },
    include: { machine: { select: { machineType: { select: { name: true } } } } },
  });
  if (!booking) {
    return { ok: false, error: "notFound" };
  }
  if (!canPayBooking(booking.status)) {
    return { ok: false, error: "notWaitingForPayment" };
  }

  const gateway = getOnlineGateway();
  const payment = await db.payment.create({
    data: {
      bookingId,
      payerId: farmer.id,
      amount: booking.totalAmount,
      method: gateway.method,
      status: "PENDING",
      transactionId: makeTransactionId(booking.code),
    },
  });

  const started = await gateway.startPayment({
    transactionId: payment.transactionId,
    amount: payment.amount,
    productName: `${booking.machine.machineType.name} work ${booking.code}`,
    customer: { name: farmer.name, phone: farmer.phone },
    locale,
  });
  if (!started.ok) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return { ok: false, error: "paymentStartFailed" };
  }
  return { ok: true, redirectUrl: started.redirectUrl };
}

/**
 * The gateway says a payment worked (the success address, or the IPN message).
 * 1. We ask the SAME gateway to confirm it (checkPayment) — never trust only the browser.
 * 2. In one transaction: the payment becomes SUCCESS and the booking PAID (markBookingPaid).
 * Safe to call twice for the same payment (the success page and the IPN often both arrive):
 * the second call finds it already SUCCESS and changes nothing.
 */
export async function confirmOnlinePayment(transactionId: string, validationId: string): Promise<ActionResult> {
  const payment = await db.payment.findUnique({ where: { transactionId } });
  if (!payment || payment.method === "CASH") {
    return { ok: false, error: "notFound" };
  }
  if (payment.status === "SUCCESS") {
    return { ok: true };
  }
  if (payment.status !== "PENDING") {
    return { ok: false, error: "paymentNotConfirmed" };
  }

  const checked = await getGateway(payment.method).checkPayment({
    transactionId,
    validationId,
    expectedAmount: payment.amount,
  });
  if (!checked.valid) {
    if (checked.tryAgain) {
      return { ok: false, error: "paymentCheckFailed" }; // stays PENDING; the IPN may still confirm it
    }
    await failOnlinePayment(transactionId, "FAILED");
    return { ok: false, error: "paymentNotConfirmed" };
  }

  return runBookingStep(async (tx) => {
    await lockBooking(tx, payment.bookingId);
    // Only a payment that is STILL pending is changed (count 0 = it was confirmed a moment ago).
    const { count } = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "SUCCESS", gatewayRef: checked.gatewayRef, paidAt: new Date() },
    });
    if (count === 0) {
      return;
    }

    const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId }, include: BOOKING_FOR_PAYMENT });
    if (canPayBooking(booking.status)) {
      await markBookingPaid(tx, booking, payment.payerId, payment);
    } else {
      // The money came in, but the booking was already paid (for example cash was recorded while
      // the farmer was paying online). We keep the money safe and ask an admin to refund it.
      await notifyAllAdmins(paidTwiceMessage(booking.code, payment.amount), tx);
    }
  });
}

/**
 * A payment try failed or the farmer cancelled it at the gateway.
 * Only a PENDING online payment is changed, so a late "fail" can never undo a success.
 */
export async function failOnlinePayment(transactionId: string, status: "FAILED" | "CANCELLED"): Promise<void> {
  await db.payment.updateMany({
    where: { transactionId, status: "PENDING", method: { not: "CASH" } },
    data: { status },
  });
}

/** What the farmer chose on the pretend bank page. */
export type MockOutcome = "pay" | "fail" | "cancel";

/**
 * The farmer pressed a button on the pretend bank page (MockGateway). Only the farmer who owns
 * the payment may do it, and only for a pretend (MOCK) payment.
 * "pay" goes through confirmOnlinePayment, exactly like a real gateway's success.
 */
export async function finishMockPayment(transactionId: string, farmerId: string, outcome: MockOutcome): Promise<ActionResult> {
  const payment = await db.payment.findFirst({ where: { transactionId, payerId: farmerId, method: "MOCK" } });
  if (!payment) {
    return { ok: false, error: "notFound" };
  }
  if (outcome === "pay") {
    return confirmOnlinePayment(transactionId, `MOCK-${transactionId}`);
  }
  await failOnlinePayment(transactionId, outcome === "fail" ? "FAILED" : "CANCELLED");
  return { ok: true };
}

// ─────────────────────────── 2. Cash on completion ───────────────────────────

/**
 * The operator (or the provider) took the farmer's cash and presses "Cash received".
 * Only the booking's own operator or the machine's own provider may do it. In one transaction:
 * a SUCCESS cash payment for the booking's total is saved, and the booking becomes PAID.
 */
export async function recordCashPayment(bookingId: string, receiverId: string): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    await lockBooking(tx, bookingId);
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, OR: [{ operatorId: receiverId }, { machine: { providerId: receiverId } }] },
      include: BOOKING_FOR_PAYMENT,
    });
    if (!booking) {
      throw new BookingProblem("notFound");
    }
    if (!canPayBooking(booking.status)) {
      throw new BookingProblem("notWaitingForPayment");
    }

    const payment = await tx.payment.create({
      data: {
        bookingId,
        payerId: booking.farmerId,
        amount: booking.totalAmount,
        method: "CASH",
        status: "SUCCESS",
        transactionId: makeTransactionId(booking.code),
        paidAt: new Date(),
      },
    });
    await markBookingPaid(tx, booking, receiverId, payment);
  });
}

// ─────────────────────────── 3. Reading payments ───────────────────────────

/** A booking's payments (newest first) with their refunds, for its booking page. */
export async function listBookingPayments(bookingId: string) {
  return db.payment.findMany({
    where: { bookingId },
    include: { refunds: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * One payment try of THIS farmer (for the success / failed / pretend bank pages), or null.
 * The pages show what the DATABASE says, not what the page address says.
 */
export async function getFarmerPayment(transactionId: string, farmerId: string) {
  return db.payment.findFirst({
    where: { transactionId, payerId: farmerId },
    include: { booking: { select: { id: true, code: true, machine: { select: { brand: true, model: true } } } } },
  });
}

/** The latest payments of everyone, with what can still be refunded. For the admin's Payments page. */
export async function listRecentPayments(take = 50) {
  const payments = await db.payment.findMany({
    include: {
      payer: { select: { name: true, phone: true } },
      booking: { select: { code: true } },
      refunds: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return payments.map((payment) => ({
    ...payment,
    refundable: payment.status === "SUCCESS" ? getRefundableAmount(payment.amount, payment.refunds) : 0,
  }));
}

/** Everything printed on a receipt (see components/receipt/receipt-document.tsx). */
export type ReceiptData = {
  receiptNo: string; // the payment's transaction id
  bookingCode: string;
  paidAt: Date;
  method: PaymentMethod;
  farmer: { name: string; phone: string };
  provider: string;
  machine: string;
  machineType: string;
  workType: WorkType;
  upazila: string;
  workDate: Date;
  quantity: number; // the billed acres / hours / days
  billingUnit: BillingUnit;
  rate: number;
  workCharge: number;
  deliveryCharge: number;
  distanceKm: number;
  subsidyAmount: number;
  totalAmount: number;
  refunded: number;
};

/**
 * The receipt of one of THIS farmer's bookings, or null if it is not theirs or not paid.
 * It uses the booking's successful payment (the first one, if it was paid twice).
 */
export async function getReceiptData(bookingId: string, farmerId: string): Promise<ReceiptData | null> {
  const booking = await db.booking.findFirst({
    where: { id: bookingId, farmerId },
    include: {
      farmer: { select: { name: true, phone: true } },
      machine: {
        select: {
          brand: true,
          model: true,
          machineType: { select: { name: true } },
          provider: { select: { name: true, providerProfile: { select: { businessName: true } } } },
        },
      },
      location: { select: { name: true } },
      payments: { where: { status: "SUCCESS" }, orderBy: { paidAt: "asc" }, include: { refunds: true } },
    },
  });
  const payment = booking?.payments[0];
  if (!booking || !payment) {
    return null;
  }

  const provider = booking.machine.provider;
  return {
    receiptNo: payment.transactionId,
    bookingCode: booking.code,
    paidAt: payment.paidAt ?? payment.createdAt,
    method: payment.method,
    farmer: booking.farmer,
    provider: provider.providerProfile?.businessName ?? provider.name,
    machine: `${booking.machine.brand} ${booking.machine.model}`,
    machineType: booking.machine.machineType.name,
    workType: booking.workType,
    upazila: booking.location.name,
    workDate: booking.startedAt ?? booking.startAt,
    quantity: booking.actualQuantity ?? booking.quantity,
    billingUnit: booking.billingUnit,
    rate: booking.rateSnapshot,
    workCharge: booking.workCharge,
    deliveryCharge: booking.deliveryCharge,
    distanceKm: booking.distanceKm,
    subsidyAmount: booking.subsidyAmount,
    totalAmount: payment.amount,
    refunded: payment.amount - getRefundableAmount(payment.amount, payment.refunds),
  };
}
