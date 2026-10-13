/**
 * Subsidy service — government discounts for small farmers.
 *
 * Phase 3 (now): find the subsidy a farmer can use today, so price estimates show it.
 * Phase 5 adds applying, the officer's approval and spending the program's budget.
 *
 * A farmer gets the discount only if ALL of these are true:
 *   1. an agriculture officer has VERIFIED the farmer (NID + land)
 *   2. the farmer has an APPROVED application for a program
 *   3. the program is switched on and today is inside its dates
 *   4. the program still has budget left (usedAmount < budget)
 * The discount is a % of the WORK charge only (see calculateBookingPrice in pricing.ts).
 */
import { db } from "@/lib/db";

/** The subsidy a farmer can use: which application, and how much discount. */
export type UsableSubsidy = {
  applicationId: string;
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
  usedAmount: number;
};

/**
 * True if the program can give discounts on this date:
 * switched on, the date is inside its dates, and there is still money left.
 */
export function isProgramOpen(program: ProgramDates, date: Date): boolean {
  const insideDates = date >= program.startAt && date <= program.endAt;
  const hasBudgetLeft = program.usedAmount < program.budget;
  return program.isActive && insideDates && hasBudgetLeft;
}

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
  const usable = applications.find((application) => isProgramOpen(application.program, date));
  if (!usable) {
    return null;
  }
  return {
    applicationId: usable.id,
    programName: usable.program.name,
    programNameBn: usable.program.nameBn,
    discountPercent: usable.program.discountPercent,
  };
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
  return programs.find((program) => isProgramOpen(program, date)) ?? null;
}
