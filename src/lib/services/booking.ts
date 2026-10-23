/**
 * Booking service — creating a booking, and every change of its status after that.
 *
 * 1. createBooking(): a farmer books a machine. Inside ONE database transaction we lock
 *    the machine, check that no other booking or blocked time overlaps (no double booking),
 *    give the booking its code (KJ-2026-000123) and save it with its first history row.
 * 2. changeBookingStatus(): THE only door for a status change. It checks that the move is
 *    allowed (ALLOWED_TRANSITIONS in booking-rules.ts) and writes a BookingStatusLog row:
 *    who changed what, and when.
 * 3. The provider's steps: acceptBooking (makes the two OTP codes), rejectBooking (with a reason)
 *    and assignOperator (an approved operator who is free at that time).
 * 4. The operator's steps: startTrip (on the way), markArrived, startWork (needs the farmer's
 *    start OTP) and finishWork (needs the finish OTP + the real amount of work -> the final bill).
 * Every step sends messages (simulated SMS) to the people involved (booking-messages.ts).
 *
 * Expected problems (a taken time, a wrong OTP...) are thrown as a BookingProblem inside the
 * transaction. Throwing cancels the whole transaction, so nothing half-done is ever saved.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { BillingUnit, BookingStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { isUniqueConstraintError } from "@/lib/db-errors";
import {
  arrivedMessage,
  bookingAcceptedMessage,
  bookingRejectedMessage,
  jobFinishedMessage,
  newJobMessage,
  newRequestMessage,
  onTheWayMessage,
  operatorAssignedMessage,
  requestSentMessage,
  workFinishedMessage,
  workStartedMessage,
  type BookingMessageInfo,
} from "@/lib/services/booking-messages";
import {
  ACTIVE_BOOKING_STATUSES,
  canChangeStatus,
  formatBookingCode,
  generateOtp,
  getBookingYear,
  getJobTimeRange,
  readBookingSerial,
} from "@/lib/services/booking-rules";
import { toDecimal } from "@/lib/services/geo";
import { findNearestUpazilaId } from "@/lib/services/location";
import { isMachineListed, isServiceDue } from "@/lib/services/machine-rules";
import { createNotification } from "@/lib/services/notification";
import { calculateBookingPrice, estimateJob, getBillingQuantity, isRateAllowed } from "@/lib/services/pricing";
import { getActivePricingRule, listPricedMachineTypes } from "@/lib/services/pricing-rule";
import { getPlatformFeePercent } from "@/lib/services/settings";
import { findUsableSubsidy } from "@/lib/services/subsidy";
import type { BookingInput, FinishWorkInput } from "@/lib/validators/booking";
import type { ActionResult, ValidationKey } from "@/lib/validators/types";

// ─────────────────────────── Problems inside a transaction ───────────────────────────

/**
 * A problem we expect, like a taken time or a wrong OTP. `key` is the error message key.
 * We THROW it inside a transaction: throwing cancels ("rolls back") the whole transaction.
 */
export class BookingProblem extends Error {
  readonly key: ValidationKey;

  constructor(key: ValidationKey) {
    super(key);
    this.key = key;
  }
}

/**
 * Runs one booking step inside a transaction and turns the outcome into an ActionResult:
 * { ok: true } when everything was saved, or { ok: false, error } when the step threw a
 * BookingProblem (then nothing was saved). Any other error is a real bug, so it is thrown on.
 */
export async function runBookingStep(step: (tx: Prisma.TransactionClient) => Promise<void>): Promise<ActionResult> {
  try {
    await db.$transaction(step);
    return { ok: true };
  } catch (error) {
    if (error instanceof BookingProblem) {
      return { ok: false, error: error.key };
    }
    throw error;
  }
}

/** An empty text box is saved as "no value" (null). */
function emptyToNull(text: string): string | null {
  return text === "" ? null : text;
}

// ─────────────────────────── Changing the status ───────────────────────────

/** Extra things a status change can save at the same time. */
type StatusChangeExtra = {
  data?: Prisma.BookingUncheckedUpdateManyInput; // more columns, e.g. the OTP codes, operatorId or startedAt
  note?: string; // saved on the history row, e.g. the reason for rejecting
};

/**
 * Changes a booking's status — the ONLY place in the app that does it.
 * 1. checks that the move is allowed (e.g. REQUESTED -> ACCEPTED yes, REQUESTED -> WORKING no)
 * 2. changes the status (and any extra columns)
 * 3. writes the history row (BookingStatusLog): from, to, who, when
 * It must run inside a transaction (tx) together with the rest of the step.
 * Throws BookingProblem("wrongBookingStatus") if the move is not allowed.
 */
export async function changeBookingStatus(
  bookingId: string,
  toStatus: BookingStatus,
  actorId: string,
  tx: Prisma.TransactionClient,
  extra: StatusChangeExtra = {},
): Promise<void> {
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (!booking) {
    throw new BookingProblem("notFound");
  }
  if (!canChangeStatus(booking.status, toStatus)) {
    throw new BookingProblem("wrongBookingStatus");
  }

  // Change it only if the status is STILL the one we just read. If someone else changed it
  // a moment ago (two people pressing buttons at once), nothing matches and count is 0.
  const { count } = await tx.booking.updateMany({
    where: { id: bookingId, status: booking.status },
    data: { ...extra.data, status: toStatus },
  });
  if (count === 0) {
    throw new BookingProblem("wrongBookingStatus");
  }

  await tx.bookingStatusLog.create({
    data: { bookingId, fromStatus: booking.status, toStatus, actorId, note: extra.note ?? null },
  });
}

// ─────────────────────────── Creating a booking ───────────────────────────

export type CreateBookingResult = { ok: true; bookingId: string } | { ok: false; error: ValidationKey };

/** A new booking row (worked out by prepareBooking), with real Date objects for the times. */
type NewBookingRow = Omit<Prisma.BookingUncheckedCreateInput, "code"> & { startAt: Date; endAt: Date };

/** Everything needed to save a new booking. */
type PreparedBooking = {
  row: NewBookingRow;
  providerId: string;
  machineName: string;
};

/**
 * Step 1 of booking (only reading, before the transaction): checks that the machine can take
 * the job, then works out the price, the time and the field's upazila.
 * Returns the booking ready to save, or an error key.
 */
async function prepareBooking(
  farmerId: string,
  input: BookingInput,
): Promise<{ ok: true; booking: PreparedBooking } | { ok: false; error: ValidationKey }> {
  const machine = await db.machine.findUnique({
    where: { id: input.machineId },
    include: { provider: { select: { status: true, providerProfile: { select: { approvalStatus: true } } } } },
  });
  const providerProfile = machine?.provider.providerProfile;
  if (!machine || !providerProfile) {
    return { ok: false, error: "notFound" };
  }

  // The same checks as the search: a price rule today, the machine listed, the provider
  // active, the rate inside the limit and no service due.
  const pricedType = (await listPricedMachineTypes()).find((type) => type.id === machine.machineTypeId);
  if (!pricedType) {
    return { ok: false, error: "noPriceRule" };
  }
  const listed = isMachineListed({
    approvalStatus: machine.approvalStatus,
    status: machine.status,
    providerApprovalStatus: providerProfile.approvalStatus,
  });
  if (!listed || machine.provider.status !== "ACTIVE" || isServiceDue(machine) || !isRateAllowed(machine.rate, pricedType)) {
    return { ok: false, error: "machineNotAvailable" };
  }
  if (!pricedType.workTypes.includes(input.workType)) {
    return { ok: false, error: "somethingWrong" }; // this machine cannot do that work
  }

  // The price, with the farmer's subsidy (if any): the same estimate the form showed.
  const field = { lat: input.lat, lng: input.lng };
  const job = { landDecimal: toDecimal(input.landValue, input.landUnit), hoursOrDays: input.hoursOrDays, field };
  const [subsidy, platformFeePercent, fieldUpazilaId] = await Promise.all([
    findUsableSubsidy(farmerId),
    getPlatformFeePercent(),
    findNearestUpazilaId(field),
  ]);
  const estimate = estimateJob(machine, pricedType, job, subsidy?.discountPercent ?? 0, platformFeePercent);
  const { startAt, endAt } = getJobTimeRange(input.day, input.startHour, pricedType.billingUnit, estimate.quantity);

  return {
    ok: true,
    booking: {
      providerId: machine.providerId,
      machineName: `${machine.brand} ${machine.model}`,
      row: {
        farmerId,
        machineId: machine.id,
        subsidyApplicationId: subsidy?.applicationId ?? null,
        workType: input.workType,
        landDecimal: job.landDecimal,
        billingUnit: pricedType.billingUnit, // copied, so a later change of the type does not change this booking
        quantity: estimate.quantity,
        startAt,
        endAt,
        fieldLat: input.lat,
        fieldLng: input.lng,
        fieldAddress: emptyToNull(input.fieldAddress),
        locationId: fieldUpazilaId ?? machine.locationId, // the field's upazila (or the machine's, if none is found)
        distanceKm: estimate.distanceKm,
        rateSnapshot: machine.rate, // a later rate change does not change this booking
        workCharge: estimate.price.workCharge,
        deliveryCharge: estimate.price.deliveryCharge,
        subsidyAmount: estimate.price.subsidyAmount,
        totalAmount: estimate.price.totalAmount,
        platformFee: estimate.price.platformFee,
        note: emptyToNull(input.note),
      },
    },
  };
}

/**
 * Looks for anything on this machine that overlaps [startAt, endAt): an active booking, or a
 * time the provider blocked. Returns the error key, or null if the time is free.
 * Two time ranges overlap when each one starts before the other one ends.
 */
async function findTimeClash(
  tx: Prisma.TransactionClient,
  machineId: string,
  startAt: Date,
  endAt: Date,
): Promise<ValidationKey | null> {
  const overlaps = { startAt: { lt: endAt }, endAt: { gt: startAt } };

  const bookingCount = await tx.booking.count({
    where: { machineId, status: { in: ACTIVE_BOOKING_STATUSES }, ...overlaps },
  });
  if (bookingCount > 0) {
    return "timeTaken";
  }

  const blockCount = await tx.availabilityBlock.count({ where: { machineId, ...overlaps } });
  if (blockCount > 0) {
    return "machineBlocked";
  }
  return null;
}

/**
 * The next free booking code of this year: the highest code so far + 1.
 * Codes are padded to 6 digits, so sorting the text also sorts the numbers.
 * Example: the last code is KJ-2026-000022 -> KJ-2026-000023
 */
async function nextBookingCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = getBookingYear();
  const last = await tx.booking.findFirst({
    where: { code: { startsWith: `KJ-${year}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastSerial = last ? readBookingSerial(last.code) : 0;
  return formatBookingCode(year, lastSerial + 1);
}

/**
 * Step 2 of booking (inside the transaction): lock, check again, save, send messages.
 * Returns the new booking's id. Throws a BookingProblem if the time is no longer free.
 */
async function saveNewBooking(tx: Prisma.TransactionClient, booking: PreparedBooking, farmerName: string): Promise<string> {
  const { machineId, farmerId, startAt, endAt } = booking.row;

  // 1. Lock this machine's row until the transaction ends ("FOR UPDATE"). If two farmers book
  //    the same machine at the same moment, the second one waits here until the first booking
  //    is saved, so the overlap check below always sees the other booking. No double booking.
  await tx.$queryRaw`SELECT id FROM "Machine" WHERE id = ${machineId} FOR UPDATE`;

  // 2. Read the machine again inside the lock: it may have gone for repair a moment ago.
  const machine = await tx.machine.findUniqueOrThrow({ where: { id: machineId } });
  if (machine.status !== "ACTIVE" || isServiceDue(machine)) {
    throw new BookingProblem("machineNotAvailable");
  }

  // 3. The time must be free: no active booking and no blocked time overlaps it.
  const clash = await findTimeClash(tx, machineId, startAt, endAt);
  if (clash) {
    throw new BookingProblem(clash);
  }

  // 4. Save the booking with the next code, and its first history row. The first row has no
  //    "from" status, because the booking did not exist before (this is not a status change).
  const code = await nextBookingCode(tx);
  const created = await tx.booking.create({ data: { ...booking.row, code, status: "REQUESTED" } });
  await tx.bookingStatusLog.create({
    data: { bookingId: created.id, fromStatus: null, toStatus: "REQUESTED", actorId: farmerId },
  });

  // 5. Tell both sides (simulated SMS).
  const info = { id: created.id, code, machineName: booking.machineName, startAt };
  await createNotification({ userId: farmerId, channel: "SMS", ...requestSentMessage(info, created.totalAmount) }, tx);
  await createNotification({ userId: booking.providerId, channel: "SMS", ...newRequestMessage(info, farmerName) }, tx);
  return created.id;
}

/** Saves the prepared booking in one transaction. A BookingProblem becomes { ok: false, error }. */
async function saveInTransaction(booking: PreparedBooking, farmerName: string): Promise<CreateBookingResult> {
  try {
    const bookingId = await db.$transaction((tx) => saveNewBooking(tx, booking, farmerName));
    return { ok: true, bookingId };
  } catch (error) {
    if (error instanceof BookingProblem) {
      return { ok: false, error: error.key };
    }
    throw error;
  }
}

/**
 * A farmer books a machine (the 3-step form's "Book now").
 * Returns the new booking's id, or an error key for the form (e.g. "timeTaken").
 */
export async function createBooking(
  farmer: { id: string; name: string },
  input: BookingInput,
): Promise<CreateBookingResult> {
  const prepared = await prepareBooking(farmer.id, input);
  if (!prepared.ok) {
    return prepared;
  }

  try {
    return await saveInTransaction(prepared.booking, farmer.name);
  } catch (error) {
    // Two bookings got the same code at the same moment. Codes are @unique, so the database
    // refused the second one; trying once more gives it the next free code.
    if (isUniqueConstraintError(error)) {
      return saveInTransaction(prepared.booking, farmer.name);
    }
    throw error;
  }
}

// ─────────────────────────── The provider's steps ───────────────────────────

/** The facts every message needs, from a booking and its machine. (payment.ts uses it too.) */
export function messageInfo(booking: { id: string; code: string; startAt: Date; machine: { brand: string; model: string } }): BookingMessageInfo {
  return {
    id: booking.id,
    code: booking.code,
    startAt: booking.startAt,
    machineName: `${booking.machine.brand} ${booking.machine.model}`,
  };
}

/**
 * A booking of one of THIS provider's machines, read inside the transaction.
 * Throws "notFound" for any other booking, so a provider can never touch another provider's booking.
 */
async function findProviderBooking(tx: Prisma.TransactionClient, bookingId: string, providerId: string) {
  const booking = await tx.booking.findFirst({
    where: { id: bookingId, machine: { providerId } },
    include: {
      machine: { select: { brand: true, model: true } },
      farmer: { select: { name: true, phone: true } },
    },
  });
  if (!booking) {
    throw new BookingProblem("notFound");
  }
  return booking;
}

/**
 * The provider accepts a request (REQUESTED -> ACCEPTED).
 * The two OTP codes are made now. They are sent only to the farmer, who gives them to the
 * operator at the field: the start code to start the work, the finish code to finish it.
 */
export async function acceptBooking(bookingId: string, providerId: string): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const booking = await findProviderBooking(tx, bookingId, providerId);
    // A request for a time that has already passed cannot be accepted any more (only rejected).
    if (booking.startAt <= new Date()) {
      throw new BookingProblem("startTimePassed");
    }

    const startOtp = generateOtp();
    const finishOtp = generateOtp();
    await changeBookingStatus(bookingId, "ACCEPTED", providerId, tx, { data: { startOtp, finishOtp } });
    await createNotification(
      { userId: booking.farmerId, channel: "SMS", ...bookingAcceptedMessage(messageInfo(booking), startOtp, finishOtp) },
      tx,
    );
  });
}

/**
 * The provider sends one of their operators to an accepted booking (ACCEPTED -> OPERATOR_ASSIGNED).
 * The operator must work for this provider, be approved by the admin, and be free at that time.
 */
export async function assignOperator(bookingId: string, providerId: string, operatorId: string): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const booking = await findProviderBooking(tx, bookingId, providerId);
    const operator = await tx.user.findFirst({
      where: {
        id: operatorId,
        role: "OPERATOR",
        status: "ACTIVE",
        operatorProfile: { providerId, approvalStatus: "APPROVED" },
      },
      select: { id: true, name: true, phone: true },
    });
    if (!operator) {
      throw new BookingProblem("operatorNotAllowed");
    }

    // Lock the operator's row (like the machine in createBooking), so the same operator cannot be
    // sent to two jobs at the same moment. Then check: one operator drives one machine at a time.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${operatorId} FOR UPDATE`;
    const otherJobs = await tx.booking.count({
      where: {
        operatorId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        startAt: { lt: booking.endAt },
        endAt: { gt: booking.startAt },
      },
    });
    if (otherJobs > 0) {
      throw new BookingProblem("operatorBusy");
    }

    await changeBookingStatus(bookingId, "OPERATOR_ASSIGNED", providerId, tx, { data: { operatorId } });
    const info = messageInfo(booking);
    await createNotification(
      { userId: operator.id, channel: "SMS", ...newJobMessage(info, booking.farmer, booking.fieldAddress) },
      tx,
    );
    await createNotification(
      { userId: booking.farmerId, channel: "SMS", ...operatorAssignedMessage(info, operator) },
      tx,
    );
  });
}

/** The provider says no to a request (REQUESTED -> REJECTED). The reason is saved and sent to the farmer. */
export async function rejectBooking(bookingId: string, providerId: string, reason: string): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const booking = await findProviderBooking(tx, bookingId, providerId);
    await changeBookingStatus(bookingId, "REJECTED", providerId, tx, { note: reason });
    await createNotification(
      { userId: booking.farmerId, channel: "SMS", ...bookingRejectedMessage(messageInfo(booking), reason) },
      tx,
    );
  });
}

// ─────────────────────────── The operator's steps ───────────────────────────

/**
 * One of THIS operator's jobs, read inside the transaction (with the OTP codes, to check them).
 * Throws "notFound" for any other booking, so an operator can only move their own jobs.
 */
async function findOperatorJob(tx: Prisma.TransactionClient, bookingId: string, operatorId: string) {
  const job = await tx.booking.findFirst({
    where: { id: bookingId, operatorId },
    include: {
      machine: { select: { brand: true, model: true, machineTypeId: true, providerId: true } },
      operator: { select: { name: true } },
      subsidyApplication: { select: { program: { select: { discountPercent: true } } } },
    },
  });
  if (!job) {
    throw new BookingProblem("notFound");
  }
  return job;
}

/** The operator sets off with the machine (OPERATOR_ASSIGNED -> ON_THE_WAY). The farmer is told. */
export async function startTrip(bookingId: string, operatorId: string): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const job = await findOperatorJob(tx, bookingId, operatorId);
    await changeBookingStatus(bookingId, "ON_THE_WAY", operatorId, tx);
    await createNotification(
      { userId: job.farmerId, channel: "SMS", ...onTheWayMessage(messageInfo(job), job.operator?.name ?? "") },
      tx,
    );
  });
}

/**
 * The operator has reached the field. "Arrived" is a step, not a status, so it does not go
 * through changeBookingStatus: we only save the time in Booking.arrivedAt. It is saved only
 * while the job is ON_THE_WAY and not marked yet (count 0 means: not allowed now).
 */
export async function markArrived(bookingId: string, operatorId: string): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const job = await findOperatorJob(tx, bookingId, operatorId);
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: "ON_THE_WAY", arrivedAt: null },
      data: { arrivedAt: new Date() },
    });
    if (count === 0) {
      throw new BookingProblem("wrongBookingStatus");
    }
    await createNotification(
      { userId: job.farmerId, channel: "SMS", ...arrivedMessage(messageInfo(job), job.operator?.name ?? "") },
      tx,
    );
  });
}

/**
 * The work starts (ON_THE_WAY -> WORKING), but only with the farmer's START code.
 * The farmer gives the code only when the machine is really at the field, so the work
 * cannot "start" without them.
 */
export async function startWork(bookingId: string, operatorId: string, otp: string): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const job = await findOperatorJob(tx, bookingId, operatorId);
    if (!job.arrivedAt) {
      throw new BookingProblem("notArrivedYet");
    }
    if (otp !== job.startOtp) {
      throw new BookingProblem("otpWrong");
    }
    await changeBookingStatus(bookingId, "WORKING", operatorId, tx, { data: { startedAt: new Date() } });
    await createNotification({ userId: job.farmerId, channel: "SMS", ...workStartedMessage(messageInfo(job)) }, tx);
  });
}

/**
 * The final bill, from the REAL amount of work the operator entered at the finish.
 * Everything else stays as it was when the farmer booked: the same rate (rateSnapshot), the
 * same distance, the price rule in force on the booking day (old rules are kept as history),
 * and the same subsidy %. Only the platform fee % is read again from the settings.
 * actualValue is decimal of land for machines rented per acre, otherwise hours or days.
 */
async function calculateFinalBill(
  job: {
    billingUnit: BillingUnit;
    rateSnapshot: number;
    distanceKm: number;
    createdAt: Date;
    machine: { machineTypeId: string };
    subsidyApplication: { program: { discountPercent: number } } | null;
  },
  actualValue: number,
) {
  const rule = await getActivePricingRule(job.machine.machineTypeId, job.createdAt);
  if (!rule) {
    throw new BookingProblem("noPriceRule");
  }
  const actualQuantity = getBillingQuantity(job.billingUnit, actualValue, actualValue);
  const price = calculateBookingPrice({
    quantity: actualQuantity,
    rate: job.rateSnapshot,
    minCharge: rule.minCharge,
    distanceKm: job.distanceKm,
    freeKm: rule.freeKm,
    deliveryRatePerKm: rule.deliveryRatePerKm,
    subsidyPercent: job.subsidyApplication?.program.discountPercent ?? 0,
    platformFeePercent: await getPlatformFeePercent(),
  });
  return { actualQuantity, price };
}

/**
 * The work is finished (WORKING -> COMPLETED), but only with the farmer's FINISH code.
 * The operator enters the real amount of work; the bill is worked out again from it, and the
 * farmer (final bill) and the provider (their share) are told.
 */
export async function finishWork(bookingId: string, operatorId: string, input: FinishWorkInput): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const job = await findOperatorJob(tx, bookingId, operatorId);
    if (input.otp !== job.finishOtp) {
      throw new BookingProblem("otpWrong");
    }

    const { actualQuantity, price } = await calculateFinalBill(job, input.actualValue);
    await changeBookingStatus(bookingId, "COMPLETED", operatorId, tx, {
      data: {
        actualQuantity,
        workCharge: price.workCharge,
        deliveryCharge: price.deliveryCharge,
        subsidyAmount: price.subsidyAmount,
        totalAmount: price.totalAmount,
        platformFee: price.platformFee,
        completedAt: new Date(),
      },
    });

    const info = messageInfo(job);
    await createNotification({ userId: job.farmerId, channel: "SMS", ...workFinishedMessage(info, price.totalAmount) }, tx);
    await createNotification({ userId: job.machine.providerId, ...jobFinishedMessage(info, price.providerAmount) }, tx);
  });
}
