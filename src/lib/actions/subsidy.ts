"use server";
// Server actions for subsidies: the farmer applies, the agriculture officer decides, and the
// government creates or changes programs. Each one checks ON THE SERVER that the user has the
// right role, checks the form again with the same Zod rules as the browser, then calls the
// service with the user's own id.
import { refreshPagesIfDone } from "@/lib/actions/refresh";
import { requireRole } from "@/lib/auth";
import { applyForSubsidy, decideSubsidyApplication } from "@/lib/services/subsidy";
import { saveSubsidyProgram } from "@/lib/services/subsidy-program";
import { approvalDecisionSchema, type ApprovalDecision } from "@/lib/validators/approval";
import { areIds } from "@/lib/validators/ids";
import {
  subsidyApplicationSchema,
  subsidyProgramSchema,
  type SubsidyApplicationInput,
  type SubsidyProgramInput,
} from "@/lib/validators/subsidy";
import type { ActionResult } from "@/lib/validators/types";

/** The farmer applies to a program. */
export async function applyForSubsidyAction(programId: string, values: SubsidyApplicationInput): Promise<ActionResult> {
  const farmer = await requireRole("FARMER");
  if (!areIds(programId)) {
    return { ok: false, error: "notFound" };
  }
  const parsed = subsidyApplicationSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "tooLong" };
  }
  return refreshPagesIfDone(await applyForSubsidy(farmer, programId, parsed.data));
}

/** The officer approves an application of their upazila, or rejects it with a reason. */
export async function decideSubsidyAction(applicationId: string, values: ApprovalDecision): Promise<ActionResult> {
  const officer = await requireRole("OFFICER");
  if (!areIds(applicationId)) {
    return { ok: false, error: "notFound" };
  }
  const parsed = approvalDecisionSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "reasonRequired" };
  }
  return refreshPagesIfDone(await decideSubsidyApplication(applicationId, officer.id, parsed.data));
}

/** The government creates a program (programId null) or changes one. */
export async function saveSubsidyProgramAction(programId: string | null, values: SubsidyProgramInput): Promise<ActionResult> {
  const govt = await requireRole("GOVT");
  if (programId !== null && !areIds(programId)) {
    return { ok: false, error: "notFound" };
  }
  const parsed = subsidyProgramSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await saveSubsidyProgram(programId, govt.id, parsed.data));
}
