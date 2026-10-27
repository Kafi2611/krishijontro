/**
 * Replacement service — after a breakdown, another machine finishes the farmer's work.
 *
 * 1. findReplacementMachines(): machines of the SAME type that are listed (approved, active,
 *    provider approved), not due for service, free for the time the rest of the work needs,
 *    and within 15 km of the field (Haversine) — nearest first, then the more trusted provider.
 * 2. notifyReplacementProviders(): right after the breakdown, the owners of those machines get
 *    an emergency message. Their Bookings page shows the offer (listReplacementOffers).
 * 3. acceptReplacement(): the FIRST provider to press "Send this machine" gets the job. In ONE
 *    transaction — the breakdown report is locked, so a second provider gets "already taken":
 *      - a new booking for the rest of the work, with parentBookingId = the broken booking, the
 *        farmer's booked rate and free delivery. It is accepted at once, with new OTP codes.
 *      - the broken booking moves BREAKDOWN -> COMPLETED, billed only for the work done
 *      - the report becomes REPLACED, and the farmer and the broken machine's provider are told
 * 4. markNoReplacement(): nobody sent a machine within 2 hours, so the admin presses "No
 *    replacement found". The broken booking is billed only for the work done (COMPLETED), or
 *    CANCELLED if nothing was done. The unfinished part is never charged (farmers pay after the
 *    work, so nothing was paid that must be given back), and the farmer joins the waitlist.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import {
  BookingProblem,
  changeBookingStatus,
  findTimeClash,
  insertNewBooking,
  messageInfo,
  retryIfCodeTaken,
  runBookingStep,
} from "@/lib/services/booking";
import {
  brokenJobCancelledMessage,
  brokenJobClosedMessage,
  noReplacementFarmerMessage,
  replacementFoundMessage,
  replacementOfferMessage,
  workDoneBillMessage,
} from "@/lib/services/breakdown-messages";
import {
  billReplacement,
  billWorkDone,
  getRemainingWork,
  getReplacementTimeRange,
  sortReplacementMachines,
  type BillPercents,
} from "@/lib/services/breakdown-rules";
import { generateOtp } from "@/lib/services/booking-rules";
import { distanceInKm } from "@/lib/services/geo";
import { isServiceDue } from "@/lib/services/machine-rules";
import { createNotification } from "@/lib/services/notification";
import type { Bill } from "@/lib/services/pricing";
import { findBusyMachineIdsBetween, LISTED_MACHINE } from "@/lib/services/search";
import { getPlatformFeePercent, getReplacementRadiusKm } from "@/lib/services/settings";
import { addToWaitlist } from "@/lib/services/waitlist";
import type { ActionResult } from "@/lib/validators/types";

// ─────────────────────────── Shared parts ───────────────────────────

/** A breakdown report with the broken booking and everything the replacement needs from it. */
const BREAKDOWN_WITH_BOOKING = {
  booking: {
    include: {
      machine: {
        select: {
          brand: true,
          model: true,
          providerId: true,
          machineTypeId: true,
          machineType: { select: { name: true, nameBn: true, icon: true } },
        },
      },
      farmer: { select: { name: true } },
      subsidyApplication: { select: { program: { select: { discountPercent: true } } } },
    },
  },
} satisfies Prisma.BreakdownReportInclude;

export type OpenBreakdown = Prisma.BreakdownReportGetPayload<{ include: typeof BREAKDOWN_WITH_BOOKING }>;

/** The subsidy % (from the broken booking) and today's platform fee %, for both bills. */
async function getBillPercents(breakdown: OpenBreakdown): Promise<BillPercents> {
  return {
    subsidyPercent: breakdown.booking.subsidyApplication?.program.discountPercent ?? 0,
    platformFeePercent: await getPlatformFeePercent(),
  };
}

/** The Booking columns of a bill (the provider's share is not saved; it is worked out from these). */
function billColumns(bill: Bill) {
  return {
    workCharge: bill.workCharge,
    deliveryCharge: bill.deliveryCharge,
    subsidyAmount: bill.subsidyAmount,
    totalAmount: bill.totalAmount,
    platformFee: bill.platformFee,
  };
}

/** The work left after the breakdown, and when a replacement would do it (if it left now). */
function getReplacementJob(breakdown: OpenBreakdown, now: Date = new Date()) {
  const remaining = getRemainingWork(breakdown.booking, breakdown.completedQuantity);
  const time = getReplacementTimeRange(breakdown.booking.billingUnit, remaining.quantity, now);
  return { remaining, ...time };
}

// ─────────────────────────── 1. Finding replacement machines ───────────────────────────

/** One machine that could replace the broken one. */
export type ReplacementMachine = {
  id: string;
  name: string; // e.g. "Kubota DC-70G"
  providerId: string;
  providerName: string;
  trustScore: number;
  distanceKm: number; // from the machine to the farmer's field
};

/**
 * The machines that could finish the work now (the rules at the top of this file), nearest first.
 * The machine's own rate does not matter: the farmer keeps the rate they booked at.
 */
export async function findReplacementMachines(breakdown: OpenBreakdown): Promise<ReplacementMachine[]> {
  const { booking } = breakdown;
  const field = { lat: booking.fieldLat, lng: booking.fieldLng };
  const radiusKm = await getReplacementRadiusKm();
  const job = getReplacementJob(breakdown);

  // Listed machines of the same type, except the broken one.
  const machines = await db.machine.findMany({
    where: { ...LISTED_MACHINE, machineTypeId: booking.machine.machineTypeId, id: { not: booking.machineId } },
    include: { provider: { select: { name: true, providerProfile: { select: { businessName: true, trustScore: true } } } } },
  });

  // Not due for service, and close enough to the field.
  const nearby = machines
    .filter((machine) => !isServiceDue(machine))
    .map((machine) => ({ machine, distanceKm: distanceInKm(machine, field) }))
    .filter((candidate) => candidate.distanceKm <= radiusKm);

  // Free for the whole time the rest of the work needs.
  const busyIds = await findBusyMachineIdsBetween(
    nearby.map((candidate) => candidate.machine.id),
    job.startAt,
    job.endAt,
  );
  const free = nearby.filter((candidate) => !busyIds.has(candidate.machine.id));

  return sortReplacementMachines(
    free.map(({ machine, distanceKm }) => ({
      id: machine.id,
      name: `${machine.brand} ${machine.model}`,
      providerId: machine.providerId,
      providerName: machine.provider.providerProfile?.businessName ?? machine.provider.name,
      trustScore: machine.provider.providerProfile?.trustScore ?? 0,
      distanceKm,
    })),
  );
}

/** Breakdowns still waiting for a replacement (status SEARCHING), oldest first. */
export async function listOpenBreakdowns(): Promise<OpenBreakdown[]> {
  return db.breakdownReport.findMany({
    where: { status: "SEARCHING" },
    include: BREAKDOWN_WITH_BOOKING,
    orderBy: { createdAt: "asc" },
  });
}

// ─────────────────────────── 2. Asking the providers ───────────────────────────

/**
 * Sends ONE emergency message to each provider who has a machine that could replace the broken
 * one (findReplacementMachines). Called right after the breakdown is saved.
 */
export async function notifyReplacementProviders(reportId: string): Promise<void> {
  const breakdown = await db.breakdownReport.findUnique({ where: { id: reportId }, include: BREAKDOWN_WITH_BOOKING });
  if (!breakdown) {
    return;
  }
  const machines = await findReplacementMachines(breakdown);
  const providerIds = new Set(machines.map((machine) => machine.providerId)); // a Set keeps each provider once
  const message = replacementOfferMessage(breakdown.booking, breakdown.booking.machine.machineType);
  await db.notification.createMany({
    data: [...providerIds].map((providerId) => ({ ...message, userId: providerId, channel: "SMS" as const })),
  });
}

/**
 * The emergency offers for THIS provider (shown on their Bookings page): every open breakdown
 * where they have at least one machine that could go, with those machines, the job, and what
 * the provider would get for it.
 */
export async function listReplacementOffers(providerId: string) {
  const offers = [];
  for (const breakdown of await listOpenBreakdowns()) {
    const machines = (await findReplacementMachines(breakdown)).filter((machine) => machine.providerId === providerId);
    if (machines.length > 0) {
      const job = getReplacementJob(breakdown);
      const bill = billReplacement(breakdown.booking, job.remaining.quantity, await getBillPercents(breakdown));
      offers.push({ breakdown, machines, job, providerAmount: bill.providerAmount });
    }
  }
  return offers;
}

export type ReplacementOffer = Awaited<ReturnType<typeof listReplacementOffers>>[number];

// ─────────────────────────── 3. A provider sends a machine ───────────────────────────

/**
 * Locks the breakdown report until the transaction ends ("FOR UPDATE") and reads it.
 * Two providers pressing "Send" (or the admin pressing "No replacement") at the same moment
 * are then handled one after the other: the second one finds it no longer SEARCHING.
 */
async function lockOpenBreakdown(tx: Prisma.TransactionClient, reportId: string): Promise<OpenBreakdown> {
  await tx.$queryRaw`SELECT id FROM "BreakdownReport" WHERE id = ${reportId} FOR UPDATE`;
  const breakdown = await tx.breakdownReport.findUnique({ where: { id: reportId }, include: BREAKDOWN_WITH_BOOKING });
  if (!breakdown) {
    throw new BookingProblem("notFound");
  }
  if (breakdown.status !== "SEARCHING") {
    throw new BookingProblem("replacementTaken");
  }
  return breakdown;
}

/**
 * Checks INSIDE the transaction (after locking the machine) that THIS provider's machine may still
 * go: listed, the same type, not the broken machine, no service due, close enough, and free.
 * Returns its name and its distance to the field. Throws a BookingProblem otherwise.
 */
async function checkReplacementMachine(
  tx: Prisma.TransactionClient,
  breakdown: OpenBreakdown,
  machineId: string,
  providerId: string,
  time: { startAt: Date; endAt: Date },
) {
  // Lock the machine's row like createBooking does, so no farmer books it at this same moment.
  await tx.$queryRaw`SELECT id FROM "Machine" WHERE id = ${machineId} FOR UPDATE`;
  const machine = await tx.machine.findFirst({ where: { id: machineId, providerId, ...LISTED_MACHINE } });
  const { booking } = breakdown;
  const isSameKind = machine?.machineTypeId === booking.machine.machineTypeId && machine.id !== booking.machineId;
  if (!machine || !isSameKind || isServiceDue(machine)) {
    throw new BookingProblem("machineNotAvailable");
  }
  const distanceKm = distanceInKm(machine, { lat: booking.fieldLat, lng: booking.fieldLng });
  if (distanceKm > (await getReplacementRadiusKm())) {
    throw new BookingProblem("machineNotAvailable");
  }
  const clash = await findTimeClash(tx, machineId, time.startAt, time.endAt);
  if (clash) {
    throw new BookingProblem(clash);
  }
  return { name: `${machine.brand} ${machine.model}`, distanceKm };
}

/**
 * The provider sends one of THEIR machines to finish a broken-down job (the steps at the top of
 * this file). Returns { ok: true }, or an error key, e.g. "replacementTaken" when another
 * provider was faster.
 */
export async function acceptReplacement(reportId: string, machineId: string, providerId: string): Promise<ActionResult> {
  return retryIfCodeTaken(() =>
    runBookingStep(async (tx) => {
      const breakdown = await lockOpenBreakdown(tx, reportId);
      const broken = breakdown.booking;
      const job = getReplacementJob(breakdown);
      const machine = await checkReplacementMachine(tx, breakdown, machineId, providerId, job);
      const percents = await getBillPercents(breakdown);

      // 1. The new booking for the rest of the work: the booked rate, free delivery, accepted at once.
      const bill = billReplacement(broken, job.remaining.quantity, percents);
      const replacement = await insertNewBooking(tx, {
        farmerId: broken.farmerId,
        machineId,
        parentBookingId: broken.id,
        subsidyApplicationId: broken.subsidyApplicationId,
        workType: broken.workType,
        landDecimal: job.remaining.landDecimal,
        billingUnit: broken.billingUnit,
        quantity: job.remaining.quantity,
        startAt: job.startAt,
        endAt: job.endAt,
        fieldLat: broken.fieldLat,
        fieldLng: broken.fieldLng,
        fieldAddress: broken.fieldAddress,
        locationId: broken.locationId,
        distanceKm: machine.distanceKm,
        rateSnapshot: broken.rateSnapshot,
        ...billColumns(bill),
      }, providerId);
      const startOtp = generateOtp();
      const finishOtp = generateOtp();
      await changeBookingStatus(replacement.id, "ACCEPTED", providerId, tx, { data: { startOtp, finishOtp } });

      // 2. The broken booking is billed only for the work done before the breakdown.
      const doneBill = billWorkDone(broken, breakdown.completedQuantity, percents);
      await changeBookingStatus(broken.id, "COMPLETED", providerId, tx, {
        data: { actualQuantity: breakdown.completedQuantity, ...billColumns(doneBill), completedAt: new Date() },
      });

      // 3. The search is over.
      await tx.breakdownReport.update({ where: { id: reportId }, data: { status: "REPLACED", resolvedAt: new Date() } });

      // 4. Tell the farmer (the new machine, its codes and the bill so far) and the broken machine's provider.
      const brokenInfo = messageInfo(broken);
      const replacementInfo = { id: replacement.id, code: replacement.code, machineName: machine.name, startAt: job.startAt };
      await createNotification(
        { userId: broken.farmerId, channel: "SMS", ...replacementFoundMessage(replacementInfo, broken.code, startOtp, finishOtp) },
        tx,
      );
      await createNotification({ userId: broken.farmerId, ...workDoneBillMessage(brokenInfo, doneBill.totalAmount) }, tx);
      await createNotification(
        { userId: broken.machine.providerId, ...brokenJobClosedMessage(brokenInfo, doneBill.providerAmount) },
        tx,
      );
    }),
  );
}

// ─────────────────────────── 4. No replacement came ───────────────────────────

/**
 * Nobody sent a machine (the admin presses "No replacement found", standing in for the 2-hour
 * wait). The broken booking is closed: billed only for the work done, or cancelled if nothing
 * was done. The farmer joins the waitlist for the rest of the work. Saved in the audit log.
 */
export async function markNoReplacement(reportId: string, adminId: string): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const breakdown = await lockOpenBreakdown(tx, reportId);
    const broken = breakdown.booking;
    const brokenInfo = messageInfo(broken);

    if (breakdown.completedQuantity > 0) {
      const doneBill = billWorkDone(broken, breakdown.completedQuantity, await getBillPercents(breakdown));
      await changeBookingStatus(broken.id, "COMPLETED", adminId, tx, {
        data: { actualQuantity: breakdown.completedQuantity, ...billColumns(doneBill), completedAt: new Date() },
      });
      await createNotification({ userId: broken.farmerId, channel: "SMS", ...noReplacementFarmerMessage(brokenInfo, doneBill.totalAmount) }, tx);
      await createNotification({ userId: broken.machine.providerId, ...brokenJobClosedMessage(brokenInfo, doneBill.providerAmount) }, tx);
    } else {
      await changeBookingStatus(broken.id, "CANCELLED", adminId, tx);
      await createNotification({ userId: broken.farmerId, channel: "SMS", ...noReplacementFarmerMessage(brokenInfo, 0) }, tx);
      await createNotification({ userId: broken.machine.providerId, ...brokenJobCancelledMessage(brokenInfo) }, tx);
    }

    await tx.breakdownReport.update({ where: { id: reportId }, data: { status: "NO_REPLACEMENT", resolvedAt: new Date() } });

    // The farmer waits for a machine of the same kind for the work that is left.
    const remaining = getRemainingWork(broken, breakdown.completedQuantity);
    await addToWaitlist(tx, {
      farmerId: broken.farmerId,
      machineTypeId: broken.machine.machineTypeId,
      workType: broken.workType,
      locationId: broken.locationId,
      fieldLat: broken.fieldLat,
      fieldLng: broken.fieldLng,
      landDecimal: remaining.landDecimal,
    });

    await writeAuditLog(
      {
        actorId: adminId,
        action: "NO_REPLACEMENT",
        entityType: "BreakdownReport",
        entityId: reportId,
        details: `No replacement found for ${broken.code}; the farmer joined the waitlist`,
      },
      tx,
    );
  });
}

// ─────────────────────────── 5. Reading, for the admin ───────────────────────────

/** How many breakdowns still wait for a replacement (the admin's dashboard). */
export async function countOpenBreakdowns(): Promise<number> {
  return db.breakdownReport.count({ where: { status: "SEARCHING" } });
}

/** The latest closed breakdowns (a replacement came, or none), newest first. */
export async function listClosedBreakdowns(take = 10) {
  return db.breakdownReport.findMany({
    where: { status: { in: ["REPLACED", "NO_REPLACEMENT"] } },
    include: BREAKDOWN_WITH_BOOKING,
    orderBy: { resolvedAt: "desc" },
    take,
  });
}
