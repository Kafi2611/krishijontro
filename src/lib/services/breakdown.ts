/**
 * Breakdown service — a machine breaks down in the middle of a job.
 *
 * reportBreakdown(): while the job is WORKING, the operator presses "Report a breakdown" and says
 * how much work was done, what is wrong, and may add a photo. In ONE transaction:
 *   1. the booking moves WORKING -> BREAKDOWN (changeBookingStatus; the problem is the note)
 *   2. a BreakdownReport is saved with status SEARCHING: we look for a replacement machine
 *   3. the engine hours of the work done are added, the machine goes UNDER_MAINTENANCE (nobody can
 *      book it now) and a REPAIR request goes to the technicians (maintenance.ts)
 *   4. the farmer, the provider and the admins are told
 * After the transaction, the owners of free machines of the same kind nearby get an emergency
 * message. What happens next — a replacement comes, or none — is in replacement.ts.
 */
import { db } from "@/lib/db";
import { BookingProblem, changeBookingStatus, findOperatorJob, messageInfo, runBookingStep } from "@/lib/services/booking";
import { breakdownAdminMessage, breakdownFarmerMessage, breakdownProviderMessage } from "@/lib/services/breakdown-messages";
import { getDoneQuantity, isDoneAmountValid } from "@/lib/services/breakdown-rules";
import { addEngineHours, createBreakdownRepair } from "@/lib/services/maintenance";
import { getEngineHoursUsed } from "@/lib/services/maintenance-rules";
import { createNotification, notifyAllAdmins } from "@/lib/services/notification";
import { notifyReplacementProviders } from "@/lib/services/replacement";
import { getReplacementRadiusKm } from "@/lib/services/settings";
import type { BreakdownInput } from "@/lib/validators/breakdown";
import type { ActionResult } from "@/lib/validators/types";

/**
 * The operator reports that the machine of THEIR job broke down (the steps at the top of this file).
 * Returns { ok: true }, or an error key, e.g. "doneTooMuch" when all the work was already done.
 */
export async function reportBreakdown(bookingId: string, operatorId: string, input: BreakdownInput): Promise<ActionResult> {
  let reportId = "";
  const radiusKm = await getReplacementRadiusKm();

  const result = await runBookingStep(async (tx) => {
    const job = await findOperatorJob(tx, bookingId, operatorId);
    // If all the work is done, the operator should press Finish (with the farmer's code) instead.
    if (!isDoneAmountValid(job, input.doneAmount)) {
      throw new BookingProblem("doneTooMuch");
    }

    // 1. WORKING -> BREAKDOWN (any other status is refused here).
    await changeBookingStatus(bookingId, "BREAKDOWN", operatorId, tx, { note: input.description });

    // 2. The report. completedQuantity is in the billing unit (acres, hours or days), like actualQuantity.
    const doneQuantity = getDoneQuantity(job.billingUnit, input.doneAmount);
    const report = await tx.breakdownReport.create({
      data: {
        bookingId,
        machineId: job.machineId,
        reportedById: operatorId,
        description: input.description,
        photoUrl: input.photoUrls[0] ?? null,
        completedQuantity: doneQuantity,
        status: "SEARCHING",
      },
    });
    reportId = report.id;

    // 3. The machine: count the hours it ran, send it for repair.
    await addEngineHours(tx, job.machineId, getEngineHoursUsed(job.billingUnit, doneQuantity));
    const machine = await tx.machine.update({ where: { id: job.machineId }, data: { status: "UNDER_MAINTENANCE" } });
    await createBreakdownRepair(tx, report, machine);

    // 4. Tell the people involved.
    const info = messageInfo(job);
    await createNotification({ userId: job.farmerId, channel: "SMS", ...breakdownFarmerMessage(info, radiusKm) }, tx);
    await createNotification(
      { userId: job.machine.providerId, ...breakdownProviderMessage(info, job.operator?.name ?? "") },
      tx,
    );
    await notifyAllAdmins(breakdownAdminMessage(info), tx);
  });

  // Only after the report is really saved: ask the owners of free machines nearby for help.
  if (result.ok) {
    await notifyReplacementProviders(reportId);
  }
  return result;
}

/**
 * The latest breakdown report of a booking (or null), for the booking pages:
 * what is wrong, the photo, the work done and how the search for a replacement is going.
 */
export async function getBookingBreakdown(bookingId: string) {
  return db.breakdownReport.findFirst({
    where: { bookingId },
    include: { reportedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
