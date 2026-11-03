/**
 * Dispute service — farmers' complaints about a finished job, and the admin's decision.
 * (The rules — who may complain, what a decision does — are in dispute-rules.ts.)
 *
 * 1. raiseDispute(): the farmer complains (once per booking). In ONE transaction the booking
 *    goes COMPLETED/PAID -> DISPUTED (through changeBookingStatus), the Dispute row is saved,
 *    and the admins, the provider and the farmer get a message.
 * 2. decideDispute(): the admin decides.
 *    - REFUND on a PAID booking: part of the payment is given back with the same refund code
 *      as the Payments page (refund.ts). Then the booking goes back to PAID.
 *    - REFUND on a booking NOT paid yet: the admin types the right amount of work, and the bill
 *      is worked out again exactly like at the finish (workOutFinalBill in booking.ts). The
 *      farmer then pays the new, lower bill (DISPUTED -> PAID).
 *    - PENALTY: the provider is fined; getBookingMoney (payment-rules.ts) takes it off their payout.
 *    - NO_ACTION: nothing changes.
 *    Every decision writes the audit log ("DISPUTE_DECIDED") and tells the farmer and the provider.
 * Two admins deciding at the same moment: the complaint is marked decided only "where it is still
 * OPEN", so only the first one wins; the second gets "alreadyDecided".
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import {
  BookingProblem,
  changeBookingStatus,
  messageInfo,
  runBookingStep,
  workOutFinalBill,
} from "@/lib/services/booking";
import { getProviderShare } from "@/lib/services/booking-rules";
import {
  complaintForAdminMessage,
  complaintForProviderMessage,
  complaintReceivedMessage,
  decisionForFarmerMessage,
  decisionForProviderMessage,
} from "@/lib/services/dispute-messages";
import { canRaiseDispute, isFineAllowed } from "@/lib/services/dispute-rules";
import { createNotification, notifyAllAdmins } from "@/lib/services/notification";
import { getRefundableAmount } from "@/lib/services/payment-rules";
import { refundPayment } from "@/lib/services/refund";
import type { ComplaintInput, DecisionInput } from "@/lib/validators/dispute";
import type { ActionResult, ValidationKey } from "@/lib/validators/types";

// ─────────────────────────── 1. The farmer complains ───────────────────────────

/**
 * The farmer reports a problem with one of THEIR OWN finished jobs (see the steps at the top).
 * Returns { ok: true }, or an error key, e.g. "alreadyComplained".
 */
export async function raiseDispute(
  bookingId: string,
  farmer: { id: string; name: string },
  input: ComplaintInput,
): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    // Lock the booking, so two complaints sent at the same moment cannot both pass the checks.
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, farmerId: farmer.id },
      include: { machine: { select: { brand: true, model: true, providerId: true } }, _count: { select: { disputes: true } } },
    });
    if (!booking) {
      throw new BookingProblem("notFound");
    }
    if (booking._count.disputes > 0) {
      throw new BookingProblem("alreadyComplained");
    }
    if (!canRaiseDispute(booking.status, false)) {
      throw new BookingProblem("cannotComplain");
    }

    // The farmer's own words go on the timeline step too, so everyone sees what the problem is.
    await changeBookingStatus(bookingId, "DISPUTED", farmer.id, tx, { note: input.description });
    await tx.dispute.create({
      data: { bookingId, raisedById: farmer.id, reason: input.reason, description: input.description },
    });

    const info = messageInfo(booking);
    await notifyAllAdmins(complaintForAdminMessage(info, farmer.name), tx);
    await createNotification({ userId: booking.machine.providerId, ...complaintForProviderMessage(info) }, tx);
    await createNotification({ userId: farmer.id, channel: "SMS", ...complaintReceivedMessage(info) }, tx);
  });
}

// ─────────────────────────── 2. Reading complaints ───────────────────────────

/**
 * The complaint about a booking (there is at most one), with who decided it and whether the
 * farmer had paid before complaining, or null.
 * The booking pages call it AFTER checking that the booking belongs to the person.
 */
export async function getBookingDispute(bookingId: string) {
  const [dispute, step] = await Promise.all([
    db.dispute.findFirst({
      where: { bookingId },
      include: { resolvedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.bookingStatusLog.findFirst({ where: { bookingId, toStatus: "DISPUTED" }, select: { fromStatus: true } }),
  ]);
  if (!dispute) {
    return null;
  }
  return { ...dispute, wasPaid: step?.fromStatus === "PAID" };
}

export type BookingDispute = NonNullable<Awaited<ReturnType<typeof getBookingDispute>>>;

/** The booking fields the admin's complaints page (and the decision) needs. */
const DISPUTE_WITH_BOOKING = {
  raisedBy: { select: { name: true, phone: true } },
  resolvedBy: { select: { name: true } },
  booking: {
    include: {
      machine: {
        select: {
          brand: true,
          model: true,
          providerId: true,
          machineTypeId: true,
          provider: { select: { name: true, phone: true, providerProfile: { select: { businessName: true } } } },
        },
      },
      subsidyApplication: { select: { program: { select: { discountPercent: true } } } },
      // THE payment is the first successful one (a second one would be refunded by an admin).
      payments: { where: { status: "SUCCESS" }, orderBy: { paidAt: "asc" }, include: { refunds: true } },
      // The history step into DISPUTED tells whether the farmer had paid before complaining.
      statusLogs: { where: { toStatus: "DISPUTED" }, select: { fromStatus: true }, take: 1 },
    },
    omit: { startOtp: true, finishOtp: true }, // the admin never sees the farmer's codes
  },
} satisfies Prisma.DisputeInclude;

type DisputeWithBooking = Prisma.DisputeGetPayload<{ include: typeof DISPUTE_WITH_BOOKING }>;

/**
 * Adds the money facts the admin needs to decide: was it paid before the complaint (the step
 * PAID -> DISPUTED in the history), how much can still be given back, and the provider's share
 * (the biggest fine allowed).
 */
function withMoneyFacts(dispute: DisputeWithBooking) {
  const payment = dispute.booking.payments[0] ?? null;
  return {
    ...dispute,
    wasPaid: dispute.booking.statusLogs[0]?.fromStatus === "PAID",
    refundable: payment ? getRefundableAmount(payment.amount, payment.refunds) : 0,
    providerShare: getProviderShare(dispute.booking),
  };
}

/** The complaints waiting for a decision, oldest first (the one waiting longest comes first). */
export async function listOpenDisputes() {
  const disputes = await db.dispute.findMany({
    where: { status: "OPEN" },
    include: DISPUTE_WITH_BOOKING,
    orderBy: { createdAt: "asc" },
  });
  return disputes.map(withMoneyFacts);
}

/** The latest decided complaints, newest decision first. */
export async function listDecidedDisputes(take = 20) {
  const disputes = await db.dispute.findMany({
    where: { status: "RESOLVED" },
    include: DISPUTE_WITH_BOOKING,
    orderBy: { resolvedAt: "desc" },
    take,
  });
  return disputes.map(withMoneyFacts);
}

/** How many complaints wait for a decision. For the admin dashboard. */
export async function countOpenDisputes(): Promise<number> {
  return db.dispute.count({ where: { status: "OPEN" } });
}

// ─────────────────────────── 3. The admin decides ───────────────────────────

/** A corrected bill: the Booking columns that change (worked out like at the finish). */
type BillColumns = {
  actualQuantity: number;
  workCharge: number;
  deliveryCharge: number;
  subsidyAmount: number;
  totalAmount: number;
  platformFee: number;
};

/** The amounts of one decision, worked out before anything is saved. */
type DecisionPlan = {
  refundAmount: number; // Tk given back, or how much lower the bill is (0 if none)
  penaltyAmount: number; // Tk fine (0 if none)
  newBill: BillColumns | null; // only for a REFUND on a booking not paid yet
};

/**
 * Checks the admin's amounts against the booking and works out what the decision does.
 * Nothing is saved here. Returns the plan, or an error key (e.g. "refundTooMuch").
 */
async function planDecision(
  dispute: ReturnType<typeof withMoneyFacts>,
  input: DecisionInput,
): Promise<{ ok: true; plan: DecisionPlan } | { ok: false; error: ValidationKey }> {
  const nothing: DecisionPlan = { refundAmount: 0, penaltyAmount: 0, newBill: null };

  if (input.decision === "PENALTY") {
    if (!isFineAllowed(input.amountTk, dispute.providerShare)) {
      return { ok: false, error: "fineTooBig" };
    }
    return { ok: true, plan: { ...nothing, penaltyAmount: input.amountTk } };
  }
  if (input.decision === "NO_ACTION") {
    return { ok: true, plan: nothing };
  }

  // REFUND, after paying: money back, at most what is left of the payment.
  if (dispute.wasPaid) {
    if (input.amountTk < 1) {
      return { ok: false, error: "amountRequired" };
    }
    if (input.amountTk > dispute.refundable) {
      return { ok: false, error: "refundTooMuch" };
    }
    return { ok: true, plan: { ...nothing, refundAmount: input.amountTk } };
  }

  // REFUND, before paying: the bill is worked out again from the right amount of work.
  if (input.correctedWork <= 0) {
    return { ok: false, error: "amountRequired" };
  }
  try {
    const { actualQuantity, price } = await workOutFinalBill(dispute.booking, input.correctedWork);
    if (price.totalAmount >= dispute.booking.totalAmount) {
      return { ok: false, error: "billNotLower" };
    }
    const newBill: BillColumns = {
      actualQuantity,
      workCharge: price.workCharge,
      deliveryCharge: price.deliveryCharge,
      subsidyAmount: price.subsidyAmount,
      totalAmount: price.totalAmount,
      platformFee: price.platformFee,
    };
    const refundAmount = dispute.booking.totalAmount - price.totalAmount;
    return { ok: true, plan: { ...nothing, refundAmount, newBill } };
  } catch (error) {
    if (error instanceof BookingProblem) {
      return { ok: false, error: error.key }; // e.g. "noPriceRule"
    }
    throw error;
  }
}

/**
 * Marks the complaint decided, but only if it is STILL open. If another admin decided it a
 * moment ago, nothing matches (count 0) and we stop with "alreadyDecided".
 */
async function closeDispute(tx: Prisma.TransactionClient, disputeId: string, adminId: string, input: DecisionInput, plan: DecisionPlan) {
  const { count } = await tx.dispute.updateMany({
    where: { id: disputeId, status: "OPEN" },
    data: {
      status: "RESOLVED",
      decision: input.decision,
      refundAmount: plan.refundAmount,
      penaltyAmount: plan.penaltyAmount,
      adminNote: input.note,
      resolvedById: adminId,
      resolvedAt: new Date(),
    },
  });
  if (count === 0) {
    throw new BookingProblem("alreadyDecided");
  }
}

/** Opens the complaint again (used when the payment gateway refused the refund). */
async function reopenDispute(disputeId: string): Promise<void> {
  await db.dispute.update({
    where: { id: disputeId },
    data: { status: "OPEN", decision: null, refundAmount: 0, penaltyAmount: 0, adminNote: null, resolvedById: null, resolvedAt: null },
  });
}

/**
 * The last part of every decision: a paid booking goes back to PAID, the audit log row,
 * and a message to the farmer and to the provider.
 */
async function finishDecision(
  tx: Prisma.TransactionClient,
  dispute: ReturnType<typeof withMoneyFacts>,
  adminId: string,
  input: DecisionInput,
  plan: DecisionPlan,
) {
  const booking = dispute.booking;
  if (dispute.wasPaid) {
    await changeBookingStatus(booking.id, "PAID", adminId, tx, { note: input.note });
  }

  const amount = plan.refundAmount || plan.penaltyAmount;
  await writeAuditLog(
    {
      actorId: adminId,
      action: "DISPUTE_DECIDED",
      entityType: "Dispute",
      entityId: dispute.id,
      details: `${booking.code}: ${input.decision}${amount > 0 ? ` ${amount} Tk` : ""} — ${input.note}`,
    },
    tx,
  );

  const info = messageInfo(booking);
  const newTotal = plan.newBill ? plan.newBill.totalAmount : booking.totalAmount;
  const facts = { decision: input.decision, wasPaid: dispute.wasPaid, amount, newTotal, note: input.note };
  await createNotification({ userId: booking.farmerId, channel: "SMS", ...decisionForFarmerMessage(info, facts) }, tx);
  await createNotification({ userId: booking.machine.providerId, ...decisionForProviderMessage(info, facts) }, tx);
}

/**
 * The admin decides a complaint (see the steps at the top of this file).
 * Returns { ok: true }, or an error key (e.g. "refundTooMuch", "billNotLower", "alreadyDecided").
 */
export async function decideDispute(disputeId: string, adminId: string, input: DecisionInput): Promise<ActionResult> {
  const found = await db.dispute.findUnique({ where: { id: disputeId }, include: DISPUTE_WITH_BOOKING });
  if (!found) {
    return { ok: false, error: "notFound" };
  }
  if (found.status !== "OPEN") {
    return { ok: false, error: "alreadyDecided" };
  }
  const dispute = withMoneyFacts(found);
  const planned = await planDecision(dispute, input);
  if (!planned.ok) {
    return planned;
  }
  const { plan } = planned;
  const payment = dispute.booking.payments[0];

  // Money back on a paid booking: the gateway is asked between two short transactions, never
  // inside one (a slow bank must not keep the database waiting). Marking the complaint decided
  // FIRST stops a second admin from giving the same money back.
  if (input.decision === "REFUND" && dispute.wasPaid) {
    if (!payment) {
      return { ok: false, error: "paymentNotRefundable" };
    }
    const closed = await runBookingStep((tx) => closeDispute(tx, disputeId, adminId, input, plan));
    if (!closed.ok) {
      return closed;
    }
    const refunded = await refundPayment(payment.id, adminId, {
      amount: plan.refundAmount,
      reason: `Complaint decision: ${input.note}`,
    });
    if (!refunded.ok) {
      await reopenDispute(disputeId); // nothing was given back, so the complaint is open again
      return refunded;
    }
    return runBookingStep((tx) => finishDecision(tx, dispute, adminId, input, plan));
  }

  // Every other decision is saved in ONE transaction.
  return runBookingStep(async (tx) => {
    await closeDispute(tx, disputeId, adminId, input, plan);
    if (plan.newBill) {
      // The lower bill is saved only while the booking still waits (DISPUTED, not paid).
      const { count } = await tx.booking.updateMany({
        where: { id: dispute.booking.id, status: "DISPUTED" },
        data: plan.newBill,
      });
      if (count === 0) {
        throw new BookingProblem("wrongBookingStatus");
      }
    }
    await finishDecision(tx, dispute, adminId, input, plan);
  });
}
