/**
 * Review service — farmers' star ratings (1 to 5) for machines and operators.
 *
 * 1. Reading: the average rating of machines (search and machine pages), a booking's reviews,
 *    and an operator's own average.
 * 2. Writing: once a job is PAID, the farmer reviews the machine and the operator separately
 *    (Review.target). In ONE transaction the two reviews are saved, the booking moves
 *    PAID -> REVIEWED, the provider's trust score is worked out again (trust.ts), and the
 *    provider and the operator are told.
 */
import { db } from "@/lib/db";
import { BookingProblem, changeBookingStatus, messageInfo, runBookingStep } from "@/lib/services/booking";
import { newReviewMessage, operatorReviewedMessage } from "@/lib/services/booking-messages";
import { createNotification } from "@/lib/services/notification";
import { refreshTrustScore } from "@/lib/services/trust";
import type { ReviewInput } from "@/lib/validators/review";
import type { ActionResult } from "@/lib/validators/types";

// ─────────────────────────── 1. Reading ───────────────────────────

export type MachineRating = {
  average: number; // e.g. 4.5
  count: number; // how many reviews
};

/** Rounds an average to one decimal, e.g. 4.33 -> 4.3 */
function roundAverage(average: number | null): number {
  return Math.round((average ?? 0) * 10) / 10;
}

/**
 * The average rating of each machine, as a Map: machineId -> { average, count }.
 * Only MACHINE reviews count here. Machines without reviews are not in the Map.
 */
export async function getMachineRatings(machineIds: string[]): Promise<Map<string, MachineRating>> {
  // groupBy = one row per machine, with the average and the count of its reviews (SQL "GROUP BY")
  const rows = await db.review.groupBy({
    by: ["machineId"],
    where: { target: "MACHINE", machineId: { in: machineIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const ratings = new Map<string, MachineRating>();
  for (const row of rows) {
    ratings.set(row.machineId, { average: roundAverage(row._avg.rating), count: row._count.rating });
  }
  return ratings;
}

/** The latest machine reviews of one machine (newest first), with the farmer's name. */
export async function listLatestMachineReviews(machineId: string, take = 3) {
  return db.review.findMany({
    where: { machineId, target: "MACHINE" },
    include: { reviewer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** The reviews of one booking (the machine's first, then the operator's). */
export async function listBookingReviews(bookingId: string) {
  return db.review.findMany({ where: { bookingId }, orderBy: { target: "asc" } });
}

/** An operator's own average rating from the OPERATOR reviews, or null without any review. */
export async function getOperatorRating(operatorId: string): Promise<MachineRating | null> {
  const result = await db.review.aggregate({
    where: { target: "OPERATOR", operatorId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  if (result._count.rating === 0) {
    return null;
  }
  return { average: roundAverage(result._avg.rating), count: result._count.rating };
}

// ─────────────────────────── 2. Writing ───────────────────────────

/** An empty comment box is saved as "no comment" (null). */
function emptyToNull(text: string): string | null {
  return text === "" ? null : text;
}

/**
 * The farmer reviews one of THEIR paid bookings: the machine and the operator, separately.
 * Returns { ok: true }, or an error key (e.g. "wrongBookingStatus" if it is not paid yet or
 * was already reviewed — then nothing is saved).
 */
export async function submitReviews(bookingId: string, farmerId: string, input: ReviewInput): Promise<ActionResult> {
  return runBookingStep(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, farmerId },
      include: { machine: { select: { brand: true, model: true, providerId: true } } },
    });
    if (!booking) {
      throw new BookingProblem("notFound");
    }

    // PAID -> REVIEWED. Any other status is refused here, so a booking is reviewed only once.
    await changeBookingStatus(bookingId, "REVIEWED", farmerId, tx);

    const common = { bookingId, reviewerId: farmerId, machineId: booking.machineId };
    await tx.review.create({
      data: { ...common, target: "MACHINE", rating: input.machineRating, comment: emptyToNull(input.machineComment) },
    });
    // Every finished job had an operator; the check only keeps the code safe.
    if (booking.operatorId) {
      await tx.review.create({
        data: {
          ...common,
          target: "OPERATOR",
          operatorId: booking.operatorId,
          rating: input.operatorRating,
          comment: emptyToNull(input.operatorComment),
        },
      });
    }

    // New stars change the provider's trust score.
    await refreshTrustScore(booking.machine.providerId, tx);

    const info = messageInfo(booking);
    const operatorStars = booking.operatorId ? input.operatorRating : null;
    await createNotification(
      { userId: booking.machine.providerId, ...newReviewMessage(info, input.machineRating, operatorStars) },
      tx,
    );
    if (booking.operatorId) {
      await createNotification({ userId: booking.operatorId, ...operatorReviewedMessage(info, input.operatorRating) }, tx);
    }
  });
}
