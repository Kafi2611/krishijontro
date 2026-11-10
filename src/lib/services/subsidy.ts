/**
 * Subsidy service — government discounts for small farmers.
 *
 * A farmer gets the discount only if ALL of these are true:
 *   1. an agriculture officer has VERIFIED the farmer (NID + land, see verification.ts)
 *   2. the farmer has an APPROVED application for a program
 *   3. the program is switched on and today is inside its dates
 *   4. the program still has money left: budget − spent − reserved
 * The discount is a % of the WORK charge only (see calculateBookingPrice in pricing.ts).
 *
 * The budget can never be overspent. A booking's subsidy is RESERVED from the moment it is
 * booked: the reserved money is the subsidy of every booking that still goes ahead and is not
 * paid yet (we add it up from the bookings, so nothing has to be "given back" by hand: a
 * cancelled or rejected booking, or one that ends without payment, simply stops counting).
 * Before a booking gets a subsidy, grantSubsidy() locks the program and checks:
 * spent + reserved + this one ≤ budget. When the farmer pays, the subsidy moves from
 * "reserved" to "spent" (spendSubsidy).
 *
 * This file has four parts:
 *   1. Rules (pure): is a program open, can this farmer apply, can the officer approve.
 *   2. Using a subsidy: the reserved money, granting a subsidy to a booking, and spending the
 *      budget when a booking is paid.
 *   3. The farmer applies to a program (the officers of their upazila are told).
 *   4. The officer of the farmer's upazila approves or rejects the application.
 * The government creates the programs (subsidy-program.ts).
 */
import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus, VerificationStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { isUniqueConstraintError } from "@/lib/db-errors";
import { writeAuditLog } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notification";
import { getOfficerUpazila, notifyUpazilaOfficers } from "@/lib/services/officer";
import { applicationDecidedMessage, applicationSentMessage } from "@/lib/services/subsidy-messages";
import type { ApprovalDecision } from "@/lib/validators/approval";
import type { SubsidyApplicationInput } from "@/lib/validators/subsidy";
import type { ActionResult, ValidationKey } from "@/lib/validators/types";

// ─────────────────────────── 1. Rules ───────────────────────────

/** The subsidy a farmer can use: which application (and program), and how much discount. */
export type UsableSubsidy = {
  applicationId: string;
  programId: string;
  programName: string;
  programNameBn: string;
  discountPercent: number; // e.g. 20 means 20% off the work charge
};

/** The program fields that decide if it is open. */
type ProgramDates = {
  isActive: boolean;
  startAt: Date;
  endAt: Date;
  budget: number;
  usedAmount: number; // spent: the subsidy of bookings that are paid
  reservedAmount: number; // reserved: the subsidy of bookings that go ahead but are not paid yet
};

/**
 * True if the program can give discounts on this date:
 * switched on, the date is inside its dates, and there is still money left.
 */
export function isProgramOpen(program: ProgramDates, date: Date): boolean {
  const insideDates = date >= program.startAt && date <= program.endAt;
  const hasBudgetLeft = program.usedAmount + program.reservedAmount < program.budget;
  return program.isActive && insideDates && hasBudgetLeft;
}

/** The program fields that decide who may apply. */
type ProgramRules = ProgramDates & { maxLandDecimal: number | null };

/** The farmer's details that decide if they may apply. */
type FarmerForSubsidy = {
  nid: string | null; // null = the farmer has not sent their details yet
  landDecimal: number;
  verificationStatus: VerificationStatus;
};

/**
 * Why this farmer cannot apply to this program now, or null if they can:
 * - "programClosed": switched off, outside its dates, or no money left
 * - "fillDetailsFirst": the farmer has not sent their NID and land, or the officer rejected them
 * - "landTooBig": the farmer has more land than the program allows
 * Example: a 150 decimal farmer and a program for up to 200 decimal -> null (may apply)
 */
export function getApplyProblem(program: ProgramRules, farmer: FarmerForSubsidy, date: Date): ValidationKey | null {
  if (!isProgramOpen(program, date)) {
    return "programClosed";
  }
  if (!farmer.nid || farmer.verificationStatus === "REJECTED") {
    return "fillDetailsFirst";
  }
  if (program.maxLandDecimal !== null && farmer.landDecimal > program.maxLandDecimal) {
    return "landTooBig";
  }
  return null;
}

/**
 * Why the officer cannot approve this application now, or null if they can.
 * The same as getApplyProblem, and also: the farmer must be VERIFIED first ("farmerNotVerified").
 */
export function getApprovalProblem(program: ProgramRules, farmer: FarmerForSubsidy, date: Date): ValidationKey | null {
  if (farmer.verificationStatus !== "VERIFIED") {
    return "farmerNotVerified";
  }
  return getApplyProblem(program, farmer, date);
}

// ─────────────────────────── 2. Using a subsidy ───────────────────────────

/**
 * The subsidy this farmer can use today (rules 1–4 at the top of this file), or null.
 * If the farmer is approved for several open programs, the biggest discount wins.
 */
export async function findUsableSubsidy(farmerId: string, date: Date = new Date()): Promise<UsableSubsidy | null> {
  const profile = await db.farmerProfile.findUnique({
    where: { userId: farmerId },
    select: { verificationStatus: true },
  });
  if (profile?.verificationStatus !== "VERIFIED") {
    return null;
  }

  const applications = await db.subsidyApplication.findMany({
    where: { farmerId, status: "APPROVED" },
    include: { program: true },
    orderBy: { program: { discountPercent: "desc" } }, // biggest discount first
  });
  const programs = await withReservedAmounts(applications.map((application) => application.program));
  const usable = applications.find((_application, index) => isProgramOpen(programs[index], date));
  if (!usable) {
    return null;
  }
  return {
    applicationId: usable.id,
    programId: usable.program.id,
    programName: usable.program.name,
    programNameBn: usable.program.nameBn,
    discountPercent: usable.program.discountPercent,
  };
}

// ─── Reserved money ───

/** Booking statuses that go ahead and are not paid yet (a complaint is handled separately). */
const UNPAID_GOING_STATUSES: BookingStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "OPERATOR_ASSIGNED",
  "ON_THE_WAY",
  "WORKING",
  "BREAKDOWN",
  "COMPLETED",
];

/**
 * The bookings whose subsidy is reserved: they have a subsidy, they still go ahead (not rejected
 * or cancelled), and they are not paid yet. A booking with a complaint (DISPUTED) keeps its
 * reservation only while it is not paid (one that was paid before the complaint has a successful
 * payment, and its subsidy is already spent).
 */
function reservedBookings(programIds: string[]): Prisma.BookingWhereInput {
  return {
    subsidyApplication: { programId: { in: programIds } },
    subsidyAmount: { gt: 0 },
    OR: [
      { status: { in: UNPAID_GOING_STATUSES } },
      { status: "DISPUTED", payments: { none: { status: "SUCCESS" } } },
    ],
  };
}

/**
 * The reserved money of each program: programId -> taka (0 if nothing is reserved).
 * `exceptBookingId` leaves one booking out (when its own subsidy is being worked out again).
 */
export async function getReservedAmounts(
  programIds: string[],
  tx: Prisma.TransactionClient = db,
  exceptBookingId?: string,
): Promise<Map<string, number>> {
  const where = reservedBookings(programIds);
  if (exceptBookingId) {
    where.id = { not: exceptBookingId };
  }
  const bookings = await tx.booking.findMany({
    where,
    select: { subsidyAmount: true, subsidyApplication: { select: { programId: true } } },
  });
  const reserved = new Map<string, number>(programIds.map((id) => [id, 0]));
  for (const booking of bookings) {
    const programId = booking.subsidyApplication!.programId; // always set: the filter asks for it
    reserved.set(programId, (reserved.get(programId) ?? 0) + booking.subsidyAmount);
  }
  return reserved;
}

/** Adds each program's reserved money (reservedAmount) to the programs, in the same order. */
export async function withReservedAmounts<T extends { id: string }>(programs: T[]): Promise<(T & { reservedAmount: number })[]> {
  const reserved = await getReservedAmounts(programs.map((program) => program.id));
  return programs.map((program) => ({ ...program, reservedAmount: reserved.get(program.id) ?? 0 }));
}

/**
 * How much subsidy a booking may get from a program now: what it asks for (`wanted`), or less if
 * the program has less money left (never below 0). Call it inside the transaction that saves the
 * booking's subsidy. The program's row is locked first ("FOR UPDATE"), so two bookings at the same
 * moment are checked one after the other, and each one sees the other's reservation. That is why
 * the budget can never be overspent.
 * `exceptBookingId`: the booking whose subsidy is worked out again (its old amount does not count).
 * Example: budget 1000, spent 600, reserved 300 -> 100 left: wanted 317 -> 100; wanted 80 -> 80
 */
export async function grantSubsidy(
  tx: Prisma.TransactionClient,
  programId: string,
  wanted: number,
  exceptBookingId?: string,
): Promise<number> {
  await tx.$queryRaw`SELECT id FROM "SubsidyProgram" WHERE id = ${programId} FOR UPDATE`;
  const program = await tx.subsidyProgram.findUniqueOrThrow({ where: { id: programId } });
  const reserved = (await getReservedAmounts([programId], tx, exceptBookingId)).get(programId) ?? 0;
  const left = program.budget - program.usedAmount - reserved;
  return Math.max(0, Math.min(wanted, left));
}

/**
 * A bill whose subsidy is at most `maxSubsidy` (the money a program could still give, see
 * grantSubsidy). Only the subsidy and what the farmer pays change: work + delivery − subsidy.
 * The platform fee and the provider's share do not depend on the subsidy, so they stay the same.
 * Example: work 1584, delivery 250, subsidy 317, at most 100 -> subsidy 100, farmer pays 1734
 */
export function limitSubsidy<T extends { workCharge: number; deliveryCharge: number; subsidyAmount: number; totalAmount: number }>(
  bill: T,
  maxSubsidy: number,
): T {
  if (bill.subsidyAmount <= maxSubsidy) {
    return bill;
  }
  const subsidyAmount = Math.max(0, maxSubsidy);
  return { ...bill, subsidyAmount, totalAmount: bill.workCharge + bill.deliveryCharge - subsidyAmount };
}

/**
 * Takes a paid booking's subsidy from its program's budget (usedAmount goes up).
 * Called inside the transaction that marks the booking PAID (payment.ts), because the
 * government's money is really spent only when the farmer has paid their part. (The same booking
 * stops counting as "reserved" because it is PAID now, so spent + reserved stays the same.)
 * "increment" adds in the database itself, so two payments at the same moment both count.
 */
export async function spendSubsidy(
  tx: Prisma.TransactionClient,
  booking: { subsidyAmount: number; subsidyApplication: { programId: string } | null },
): Promise<void> {
  if (!booking.subsidyApplication || booking.subsidyAmount <= 0) {
    return;
  }
  await tx.subsidyProgram.update({
    where: { id: booking.subsidyApplication.programId },
    data: { usedAmount: { increment: booking.subsidyAmount } },
  });
}

/**
 * The open program with the biggest discount, or null.
 * The public price calculator uses it for its "I have a subsidy" box.
 */
export async function findOpenSubsidyProgram(date: Date = new Date()) {
  const programs = await db.subsidyProgram.findMany({
    where: { isActive: true, startAt: { lte: date }, endAt: { gte: date } },
    orderBy: { discountPercent: "desc" },
  });
  const withReserved = await withReservedAmounts(programs);
  return withReserved.find((program) => isProgramOpen(program, date)) ?? null;
}

// ─────────────────────────── 3. The farmer applies ───────────────────────────

/**
 * The programs a farmer can see on their subsidy page: every switched-on program whose dates
 * include today, each with the farmer's own application (if any) and why they cannot apply
 * (if they cannot). Newest program first.
 */
export async function listProgramsForFarmer(farmerId: string, date: Date = new Date()) {
  const [found, profile] = await Promise.all([
    db.subsidyProgram.findMany({
      where: { isActive: true, startAt: { lte: date }, endAt: { gte: date } },
      include: { applications: { where: { farmerId } } },
      orderBy: { startAt: "desc" },
    }),
    db.farmerProfile.findUnique({ where: { userId: farmerId } }),
  ]);
  const programs = await withReservedAmounts(found);
  return programs.map((program) => ({
    program,
    application: program.applications[0] ?? null, // at most one: a farmer applies to a program once
    problem: profile ? getApplyProblem(program, profile, date) : "fillDetailsFirst",
  }));
}

/**
 * The farmer applies to a program (or applies again after a rejection).
 * The rules are in getApplyProblem. The officers of the farmer's upazila get a message.
 */
export async function applyForSubsidy(
  farmer: { id: string; name: string },
  programId: string,
  input: SubsidyApplicationInput,
): Promise<ActionResult> {
  const [foundProgram, profile, existing] = await Promise.all([
    db.subsidyProgram.findUnique({ where: { id: programId } }),
    db.farmerProfile.findUnique({ where: { userId: farmer.id } }),
    db.subsidyApplication.findUnique({ where: { programId_farmerId: { programId, farmerId: farmer.id } } }),
  ]);
  if (!foundProgram || !profile?.locationId) {
    return { ok: false, error: "notFound" };
  }
  const [program] = await withReservedAmounts([foundProgram]);
  const problem = getApplyProblem(program, profile, new Date());
  if (problem) {
    return { ok: false, error: problem };
  }
  // One application per program. Only a rejected one may be sent again.
  if (existing && existing.status !== "REJECTED") {
    return { ok: false, error: "alreadyApplied" };
  }

  const upazilaId = profile.locationId;
  const note = input.note === "" ? null : input.note;
  try {
    const applied = await db.$transaction(async (tx) => {
      if (existing) {
        // Change it only if it is STILL rejected (count 0 = it was sent again a moment ago).
        const { count } = await tx.subsidyApplication.updateMany({
          where: { id: existing.id, status: "REJECTED" },
          data: { status: "PENDING", note, reviewedById: null, reviewedAt: null, rejectionReason: null },
        });
        if (count === 0) {
          return false;
        }
      } else {
        await tx.subsidyApplication.create({ data: { programId, farmerId: farmer.id, note } });
      }
      await notifyUpazilaOfficers(upazilaId, applicationSentMessage(farmer.name, program.name), tx);
      return true;
    });
    return applied ? { ok: true } : { ok: false, error: "alreadyApplied" };
  } catch (error) {
    // Two clicks at the same moment: the database refuses the second application (it is @@unique).
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "alreadyApplied" };
    }
    throw error;
  }
}

// ─────────────────────────── 4. The officer decides ───────────────────────────

/** Only the applications of farmers who live in this upazila. */
function inUpazila(upazilaId: string): Prisma.SubsidyApplicationWhereInput {
  return { farmer: { farmerProfile: { is: { locationId: upazilaId } } } };
}

/** What the officer's list shows about each application. */
const APPLICATION_FOR_OFFICER = {
  program: true,
  farmer: {
    select: {
      name: true,
      phone: true,
      farmerProfile: { select: { nid: true, landDecimal: true, village: true, verificationStatus: true } },
    },
  },
} satisfies Prisma.SubsidyApplicationInclude;

/**
 * The officer's "Subsidy applications" page: the waiting applications of the officer's
 * upazila (oldest first, each with why it cannot be approved, if so) and the ones decided
 * most recently. Null if the officer has no upazila.
 */
export async function listApplicationsForOfficer(officerId: string) {
  const upazila = await getOfficerUpazila(officerId);
  if (!upazila) {
    return null;
  }
  const [waiting, recent] = await Promise.all([
    db.subsidyApplication.findMany({
      where: { ...inUpazila(upazila.id), status: "PENDING" },
      include: APPLICATION_FOR_OFFICER,
      orderBy: { createdAt: "asc" },
    }),
    db.subsidyApplication.findMany({
      where: { ...inUpazila(upazila.id), status: { in: ["APPROVED", "REJECTED"] } },
      include: APPLICATION_FOR_OFFICER,
      orderBy: { reviewedAt: "desc" },
      take: 10,
    }),
  ]);

  const now = new Date();
  const programs = await withReservedAmounts(waiting.map((application) => application.program));
  return {
    upazila,
    waiting: waiting.map((application, index) => {
      const profile = application.farmer.farmerProfile;
      const problem = profile ? getApprovalProblem(programs[index], profile, now) : "farmerNotVerified";
      return { ...application, problem };
    }),
    recent,
  };
}

/** How many applications of the officer's upazila wait for a decision (for the dashboard). */
export async function countApplicationsToDecide(officerId: string): Promise<number> {
  const upazila = await getOfficerUpazila(officerId);
  if (!upazila) {
    return 0;
  }
  return db.subsidyApplication.count({ where: { ...inUpazila(upazila.id), status: "PENDING" } });
}

/**
 * The officer approves or rejects (with a reason) an application of a farmer of THEIR upazila.
 * Approving follows getApprovalProblem (the farmer must be verified, and so on).
 * In one transaction: the new status, an audit log row and a message to the farmer.
 * Only a PENDING application can be decided, so two officers cannot decide it twice.
 */
export async function decideSubsidyApplication(
  applicationId: string,
  officerId: string,
  decision: ApprovalDecision,
): Promise<ActionResult> {
  const upazila = await getOfficerUpazila(officerId);
  const application = await db.subsidyApplication.findUnique({
    where: { id: applicationId },
    include: { program: true, farmer: { select: { name: true, farmerProfile: true } } },
  });
  const profile = application?.farmer.farmerProfile;
  // An application from another upazila is "not found" for this officer.
  if (!upazila || !application || !profile || profile.locationId !== upazila.id) {
    return { ok: false, error: "notFound" };
  }
  if (application.status !== "PENDING") {
    return { ok: false, error: "alreadyDecided" };
  }
  if (decision.approve) {
    const [programNow] = await withReservedAmounts([application.program]);
    const problem = getApprovalProblem(programNow, profile, new Date());
    if (problem) {
      return { ok: false, error: problem };
    }
  }

  const { program } = application;
  const decided = await db.$transaction(async (tx) => {
    const { count } = await tx.subsidyApplication.updateMany({
      where: { id: applicationId, status: "PENDING" },
      data: {
        status: decision.approve ? "APPROVED" : "REJECTED",
        reviewedById: officerId,
        reviewedAt: new Date(),
        rejectionReason: decision.approve ? null : decision.reason,
      },
    });
    if (count === 0) {
      return false; // another officer decided a moment ago; nothing was changed
    }
    await writeAuditLog(
      {
        actorId: officerId,
        action: decision.approve ? "SUBSIDY_APPROVED" : "SUBSIDY_REJECTED",
        entityType: "SubsidyApplication",
        entityId: applicationId,
        details: decision.approve
          ? `Approved ${application.farmer.name} for ${program.name}`
          : `Rejected ${application.farmer.name} for ${program.name}: ${decision.reason}`,
      },
      tx,
    );
    await createNotification(
      {
        userId: application.farmerId,
        channel: "SMS",
        ...applicationDecidedMessage(decision.approve, program, decision.reason),
      },
      tx,
    );
    return true;
  });
  return decided ? { ok: true } : { ok: false, error: "alreadyDecided" };
}
