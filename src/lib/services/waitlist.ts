/**
 * Waitlist service — a farmer who finds no free machine can wait for one.
 *
 * 1. Joining: from the search page when no machine is free (joinWaitlist), or by itself when a
 *    machine broke down and no replacement came (addToWaitlist, called by replacement.ts).
 * 2. Telling: when a machine of that kind becomes free near the field — a farmer cancelled a
 *    booking on that day, or a machine came back from repair — the FIRST waiting farmer (the one
 *    who joined earliest) gets a message with a ready search (notifyWaitlist). Their entry becomes
 *    NOTIFIED, so the next free machine goes to the next farmer in the line.
 * 3. The farmer sees their entries on the Waitlist page and can leave the list.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { WorkType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { endOfDhakaDay, startOfDhakaDay, toDhakaDay } from "@/lib/services/calendar";
import { distanceInKm, toDecimal } from "@/lib/services/geo";
import { findNearestUpazilaId } from "@/lib/services/location";
import { createNotification } from "@/lib/services/notification";
import { DEFAULT_HOURS_OR_DAYS } from "@/lib/services/search";
import { machineFreeMessage } from "@/lib/services/waitlist-messages";
import { searchInputToQuery } from "@/lib/validators/search";
import type { ActionResult } from "@/lib/validators/types";
import type { JoinWaitlistInput } from "@/lib/validators/waitlist";

/** A waiting farmer is told only about machines this close to their field. */
export const WAITLIST_RADIUS_KM = 25;

// ─────────────────────────── 1. Joining and leaving ───────────────────────────

/**
 * The farmer joins the waitlist for one kind of machine on one day (from the search page).
 * Refused if that kind of machine cannot do the work, or the farmer already waits for it that day.
 */
export async function joinWaitlist(farmerId: string, input: JoinWaitlistInput): Promise<ActionResult> {
  const machineType = await db.machineType.findUnique({ where: { id: input.machineTypeId } });
  if (!machineType || !machineType.isActive || !machineType.workTypes.includes(input.workType)) {
    return { ok: false, error: "somethingWrong" };
  }

  const wantedDate = startOfDhakaDay(input.day);
  const alreadyWaiting = await db.waitlistEntry.count({
    where: { farmerId, machineTypeId: input.machineTypeId, wantedDate, status: "WAITING" },
  });
  if (alreadyWaiting > 0) {
    return { ok: false, error: "alreadyWaiting" };
  }

  const field = { lat: input.lat, lng: input.lng };
  await db.waitlistEntry.create({
    data: {
      farmerId,
      machineTypeId: input.machineTypeId,
      workType: input.workType,
      locationId: await findNearestUpazilaId(field),
      fieldLat: field.lat,
      fieldLng: field.lng,
      landDecimal: toDecimal(input.landValue, input.landUnit),
      wantedDate,
    },
  });
  return { ok: true };
}

/** What a waitlist entry needs when the system adds the farmer by itself (after a breakdown). */
type NewEntry = {
  farmerId: string;
  machineTypeId: string;
  workType: WorkType;
  locationId: string;
  fieldLat: number;
  fieldLng: number;
  landDecimal: number;
};

/** Adds the farmer to the waitlist for today, inside the caller's transaction (see replacement.ts). */
export async function addToWaitlist(tx: Prisma.TransactionClient, entry: NewEntry): Promise<void> {
  const today = toDhakaDay(new Date());
  await tx.waitlistEntry.create({ data: { ...entry, wantedDate: startOfDhakaDay(today) } });
}

/** The farmer leaves the list. Only their own entry, and only while it is still open. */
export async function leaveWaitlist(entryId: string, farmerId: string): Promise<ActionResult> {
  const { count } = await db.waitlistEntry.updateMany({
    where: { id: entryId, farmerId, status: { in: ["WAITING", "NOTIFIED"] } },
    data: { status: "CANCELLED" },
  });
  if (count === 0) {
    return { ok: false, error: "notFound" };
  }
  return { ok: true };
}

/** The farmer's entries, newest first, with the machine type's name and icon. */
export async function listFarmerWaitlist(farmerId: string) {
  return db.waitlistEntry.findMany({
    where: { farmerId },
    include: { machineType: { select: { name: true, nameBn: true, icon: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** How many entries of this farmer are still waiting (for the dashboard). */
export async function countFarmerWaiting(farmerId: string): Promise<number> {
  return db.waitlistEntry.count({ where: { farmerId, status: "WAITING" } });
}

// ─────────────────────────── 2. Telling the first waiting farmer ───────────────────────────

/** A machine that became free: its kind, where it is, and the days it is free. */
export type FreedMachine = {
  machineTypeId: string;
  lat: number;
  lng: number;
  fromDay: string; // "YYYY-MM-DD"
  toDay: string | null; // null = from fromDay on (a machine back from repair)
};

/** The search the message opens: the farmer's own job, already filled in. */
function searchLinkFor(entry: { workType: WorkType; machineTypeId: string; landDecimal: number; fieldLat: number; fieldLng: number }, day: string): string {
  const query = searchInputToQuery({
    workType: entry.workType,
    machineTypeId: entry.machineTypeId,
    landValue: entry.landDecimal,
    landUnit: "DECIMAL",
    hoursOrDays: DEFAULT_HOURS_OR_DAYS,
    day,
    lat: entry.fieldLat,
    lng: entry.fieldLng,
    maxKm: WAITLIST_RADIUS_KM,
    sort: "nearest",
  });
  return `/farmer/search?${query}`;
}

/**
 * A machine became free: tells the first farmer who waits for that kind of machine, on one of
 * the free days, with a field within WAITLIST_RADIUS_KM. Runs inside the caller's transaction.
 * Their entry becomes NOTIFIED. Nobody waiting -> nothing happens.
 */
export async function notifyWaitlist(tx: Prisma.TransactionClient, freed: FreedMachine): Promise<void> {
  // A day that is already over cannot be booked any more, so we start from today at the earliest.
  const today = toDhakaDay(new Date());
  const fromDay = freed.fromDay > today ? freed.fromDay : today;
  if (freed.toDay !== null && freed.toDay < fromDay) {
    return;
  }

  const wantedDate = freed.toDay
    ? { gte: startOfDhakaDay(fromDay), lte: endOfDhakaDay(freed.toDay) }
    : { gte: startOfDhakaDay(fromDay) };
  const waiting = await tx.waitlistEntry.findMany({
    where: { machineTypeId: freed.machineTypeId, status: "WAITING", wantedDate },
    include: { machineType: { select: { name: true, nameBn: true } } },
    orderBy: { createdAt: "asc" }, // first come, first told
  });
  const first = waiting.find((entry) => distanceInKm(freed, { lat: entry.fieldLat, lng: entry.fieldLng }) <= WAITLIST_RADIUS_KM);
  if (!first) {
    return;
  }

  await tx.waitlistEntry.update({ where: { id: first.id }, data: { status: "NOTIFIED", notifiedAt: new Date() } });
  const day = toDhakaDay(first.wantedDate);
  await createNotification(
    { userId: first.farmerId, channel: "SMS", ...machineFreeMessage(first.machineType, day, searchLinkFor(first, day)) },
    tx,
  );
}
