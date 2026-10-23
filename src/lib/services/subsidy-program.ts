/**
 * Subsidy program service — the government creates and changes subsidy programs.
 *
 * A program says: "X% off the work charge, for farmers with up to Y decimal of land, between
 * these dates, until this budget is spent". Farmers apply to it, officers approve them
 * (subsidy.ts), and each paid booking spends some of its budget (spendSubsidy in subsidy.ts).
 * Every create or change writes an audit log row (who changed what, and when).
 */
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import { endOfDhakaDay, startOfDhakaDay, toDhakaDay } from "@/lib/services/calendar";
import { isProgramOpen } from "@/lib/services/subsidy";
import type { SubsidyProgramInput } from "@/lib/validators/subsidy";
import type { ActionResult } from "@/lib/validators/types";

/**
 * Every program (newest first) with its application counts and whether it is open today.
 * For the government's "Subsidy programs" page.
 */
export async function listSubsidyPrograms() {
  const [programs, counts] = await Promise.all([
    db.subsidyProgram.findMany({ orderBy: { startAt: "desc" } }),
    // One row per program and status, e.g. { programId: "abc", status: "PENDING", _count: 3 }
    db.subsidyApplication.groupBy({ by: ["programId", "status"], _count: true }),
  ]);

  /** How many applications of this program have this status. */
  function countOf(programId: string, status: string): number {
    const row = counts.find((item) => item.programId === programId && item.status === status);
    return row?._count ?? 0;
  }

  const now = new Date();
  return programs.map((program) => ({
    program,
    isOpen: isProgramOpen(program, now),
    pending: countOf(program.id, "PENDING"),
    approved: countOf(program.id, "APPROVED"),
  }));
}

/** One program, or null. */
export async function getSubsidyProgram(programId: string) {
  return db.subsidyProgram.findUnique({ where: { id: programId } });
}

/** A saved program turned into the values the form starts with (days as "YYYY-MM-DD"). */
export function programToFormValues(program: {
  name: string;
  nameBn: string;
  description: string | null;
  discountPercent: number;
  maxLandDecimal: number | null;
  budget: number;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
}): SubsidyProgramInput {
  return {
    name: program.name,
    nameBn: program.nameBn,
    description: program.description ?? "",
    discountPercent: program.discountPercent,
    maxLandDecimal: program.maxLandDecimal ?? undefined,
    budget: program.budget,
    startDay: toDhakaDay(program.startAt),
    endDay: toDhakaDay(program.endAt),
    isActive: program.isActive,
  };
}

/**
 * Creates a program (programId null) or changes one. The first day starts at midnight and the
 * last day ends at 23:59:59, Bangladesh time. When changing, the budget may not go below what
 * is already spent ("budgetBelowUsed").
 */
export async function saveSubsidyProgram(
  programId: string | null,
  govtId: string,
  input: SubsidyProgramInput,
): Promise<ActionResult> {
  const data = {
    name: input.name,
    nameBn: input.nameBn,
    description: input.description === "" ? null : input.description,
    discountPercent: input.discountPercent,
    maxLandDecimal: input.maxLandDecimal ?? null, // null = any farmer may apply
    budget: input.budget,
    startAt: startOfDhakaDay(input.startDay),
    endAt: endOfDhakaDay(input.endDay),
    isActive: input.isActive,
  };

  if (programId) {
    const existing = await db.subsidyProgram.findUnique({ where: { id: programId } });
    if (!existing) {
      return { ok: false, error: "notFound" };
    }
    if (input.budget < existing.usedAmount) {
      return { ok: false, error: "budgetBelowUsed" };
    }
  }

  await db.$transaction(async (tx) => {
    const program = programId
      ? await tx.subsidyProgram.update({ where: { id: programId }, data })
      : await tx.subsidyProgram.create({ data });
    await writeAuditLog(
      {
        actorId: govtId,
        action: programId ? "SUBSIDY_PROGRAM_UPDATED" : "SUBSIDY_PROGRAM_CREATED",
        entityType: "SubsidyProgram",
        entityId: program.id,
        details: `${program.name}: ${program.discountPercent}% off, budget ${program.budget} Tk${program.isActive ? "" : " (switched off)"}`,
      },
      tx,
    );
  });
  return { ok: true };
}

/** The money of all programs together, for the government dashboard. */
export async function getSubsidyTotals() {
  const totals = await db.subsidyProgram.aggregate({ _sum: { budget: true, usedAmount: true } });
  return { budget: totals._sum.budget ?? 0, used: totals._sum.usedAmount ?? 0 };
}
