/**
 * Availability service — the days a machine can NOT be booked.
 *
 * A provider "blocks" days (own land work, family program, repair...). Each block is
 * one AvailabilityBlock row with a time range [startAt, endAt). The calendar page
 * shows blocked days and booked days; Phase 4's booking check refuses any booking
 * that overlaps a block.
 *
 * Rules for a new block:
 * - only on the provider's own machine
 * - not in the past, at most 60 days at once
 * - not on days that already have an active booking (cancel the booking first)
 * - not on days that are already blocked
 */
import type { BookingStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  addDays,
  blockRangeFromDays,
  buildMonthGrid,
  countDays,
  monthGridRange,
  startOfDhakaDay,
  toDhakaDay,
} from "@/lib/services/calendar";
import type { AvailabilityBlockInput } from "@/lib/validators/availability";
import type { ActionResult } from "@/lib/validators/types";

/** The most days a provider may block in one go. */
export const MAX_BLOCK_DAYS = 60;

/**
 * Booking statuses that keep the machine busy. (A cancelled, rejected or finished
 * booking does not.) Phase 4's double-booking check uses the same list.
 */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "OPERATOR_ASSIGNED",
  "ON_THE_WAY",
  "WORKING",
];

/** Finds the provider's machine (or null), so we never touch someone else's machine. */
async function findOwnMachine(machineId: string, providerId: string) {
  return db.machine.findFirst({
    where: { id: machineId, providerId },
    include: { machineType: true },
  });
}

/**
 * Everything the calendar page shows for one month:
 * the machine, the grid of days (with their colours) and the upcoming blocks.
 * Returns null if the machine is not this provider's.
 */
export async function getMachineCalendar(machineId: string, providerId: string, month: string) {
  const machine = await findOwnMachine(machineId, providerId);
  if (!machine) {
    return null;
  }

  // Only load bookings and blocks that touch the days visible on the grid.
  const { firstDay, lastDay } = monthGridRange(month);
  const gridStart = startOfDhakaDay(firstDay);
  const gridEnd = startOfDhakaDay(addDays(lastDay, 1));
  const touchesGrid = { startAt: { lt: gridEnd }, endAt: { gt: gridStart } };

  const [bookings, blocks, upcomingBlocks] = await Promise.all([
    db.booking.findMany({
      where: { machineId, status: { in: ACTIVE_BOOKING_STATUSES }, ...touchesGrid },
      select: { startAt: true, endAt: true },
    }),
    db.availabilityBlock.findMany({
      where: { machineId, ...touchesGrid },
      select: { startAt: true, endAt: true },
    }),
    // The list under the calendar: blocks that are not over yet, soonest first
    db.availabilityBlock.findMany({
      where: { machineId, endAt: { gt: new Date() } },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const today = toDhakaDay(new Date());
  return {
    machine,
    today,
    weeks: buildMonthGrid(month, today, { booked: bookings, blocked: blocks }),
    upcomingBlocks,
  };
}

/**
 * Blocks the days fromDay..toDay (both included) for one of the provider's machines.
 * Returns ok, or an error key explaining why not.
 */
export async function addAvailabilityBlock(
  machineId: string,
  providerId: string,
  input: AvailabilityBlockInput,
): Promise<ActionResult> {
  const machine = await findOwnMachine(machineId, providerId);
  if (!machine) {
    return { ok: false, error: "notFound" };
  }
  if (input.fromDay < toDhakaDay(new Date())) {
    return { ok: false, error: "dateInPast" };
  }
  if (countDays(input.fromDay, input.toDay) > MAX_BLOCK_DAYS) {
    return { ok: false, error: "rangeTooLong" };
  }

  const { startAt, endAt } = blockRangeFromDays(input.fromDay, input.toDay);
  // Two ranges overlap when each one starts before the other one ends.
  const overlaps = { startAt: { lt: endAt }, endAt: { gt: startAt } };

  const bookingCount = await db.booking.count({
    where: { machineId, status: { in: ACTIVE_BOOKING_STATUSES }, ...overlaps },
  });
  if (bookingCount > 0) {
    return { ok: false, error: "blockHasBooking" };
  }

  const blockCount = await db.availabilityBlock.count({ where: { machineId, ...overlaps } });
  if (blockCount > 0) {
    return { ok: false, error: "alreadyBlocked" };
  }

  await db.availabilityBlock.create({
    data: { machineId, startAt, endAt, reason: input.reason === "" ? null : input.reason },
  });
  return { ok: true };
}

/** Removes one block, but only if it belongs to one of this provider's machines. */
export async function removeAvailabilityBlock(blockId: string, providerId: string): Promise<ActionResult> {
  const block = await db.availabilityBlock.findFirst({
    where: { id: blockId, machine: { providerId } },
  });
  if (!block) {
    return { ok: false, error: "notFound" };
  }
  await db.availabilityBlock.delete({ where: { id: blockId } });
  return { ok: true };
}
