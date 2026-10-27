/**
 * Cancellation service — the farmer or the provider cancels a booking before the work starts.
 * The rules (who may cancel when, and the farmer's late fee) are in cancellation-rules.ts.
 *
 * cancelByFarmer(): REQUESTED / ACCEPTED / OPERATOR_ASSIGNED -> CANCELLED. A late fee (if any) is
 *   saved on the booking (Booking.cancellationFee) and shown on both booking pages. The provider
 *   and the operator (if one was sent) are told, and the first farmer waiting for that kind of
 *   machine on that day is told it may be free now (waitlist.ts).
 * cancelByProvider(): ACCEPTED / OPERATOR_ASSIGNED -> CANCELLED, with a reason. The farmer owes
 *   nothing and is told; the provider's trust score goes down (trust.ts).
 * The status change goes through changeBookingStatus, so if someone else moved the booking a
 * moment ago (e.g. the operator pressed "On the way"), the cancel is refused and nothing is saved.
 */
import type { Prisma } from "@/generated/prisma/client";
import { BookingProblem, changeBookingStatus, messageInfo, runBookingStep } from "@/lib/services/booking";
import { farmerCancelledMessage, jobCancelledMessage, providerCancelledMessage } from "@/lib/services/booking-messages";
import { toDhakaDay } from "@/lib/services/calendar";
import { canFarmerCancel, canProviderCancel, getCancellationFee } from "@/lib/services/cancellation-rules";
import { createNotification } from "@/lib/services/notification";
import { getCancellationRules } from "@/lib/services/settings";
import { refreshTrustScore } from "@/lib/services/trust";
import { notifyWaitlist } from "@/lib/services/waitlist";
import type { ActionResult } from "@/lib/validators/types";

/** The machine fields a cancellation needs: its name, owner, kind and place (for the waitlist). */
const MACHINE_FOR_CANCEL = {
  machine: { select: { brand: true, model: true, providerId: true, machineTypeId: true, lat: true, lng: true } },
} satisfies Prisma.BookingInclude;

/**
 * The farmer cancels one of THEIR bookings. The late fee is worked out now, with today's settings.
 * Returns { ok: true }, or an error key (e.g. "cannotCancel" once the operator has set off).
 */
export async function cancelByFarmer(bookingId: string, farmerId: string): Promise<ActionResult> {
  const rules = await getCancellationRules();
  return runBookingStep(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: bookingId, farmerId }, include: MACHINE_FOR_CANCEL });
    if (!booking) {
      throw new BookingProblem("notFound");
    }
    if (!canFarmerCancel(booking.status)) {
      throw new BookingProblem("cannotCancel");
    }

    const fee = getCancellationFee(booking, rules);
    await changeBookingStatus(bookingId, "CANCELLED", farmerId, tx, { data: { cancellationFee: fee } });

    const info = messageInfo(booking);
    await createNotification({ userId: booking.machine.providerId, ...farmerCancelledMessage(info, fee) }, tx);
    if (booking.operatorId) {
      await createNotification({ userId: booking.operatorId, channel: "SMS", ...jobCancelledMessage(info) }, tx);
    }

    // The machine is free again on that day: tell the first farmer waiting for one like it.
    const day = toDhakaDay(booking.startAt);
    const { machine } = booking;
    await notifyWaitlist(tx, { machineTypeId: machine.machineTypeId, lat: machine.lat, lng: machine.lng, fromDay: day, toDay: day });
  });
}

/**
 * The provider cancels a booking of THEIR machine that they had accepted, with a reason.
 * The farmer owes nothing; the provider's trust score is worked out again (it goes down).
 */
export async function cancelByProvider(bookingId: string, providerId: string, reason: string): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, machine: { providerId } },
      include: MACHINE_FOR_CANCEL,
    });
    if (!booking) {
      throw new BookingProblem("notFound");
    }
    if (!canProviderCancel(booking.status)) {
      throw new BookingProblem("cannotCancel");
    }

    await changeBookingStatus(bookingId, "CANCELLED", providerId, tx, { note: reason });
    // The new history row counts as a cancellation by the provider, so the score goes down.
    await refreshTrustScore(providerId, tx);

    const info = messageInfo(booking);
    await createNotification({ userId: booking.farmerId, channel: "SMS", ...providerCancelledMessage(info, reason) }, tx);
    if (booking.operatorId) {
      await createNotification({ userId: booking.operatorId, channel: "SMS", ...jobCancelledMessage(info) }, tx);
    }
  });
}
