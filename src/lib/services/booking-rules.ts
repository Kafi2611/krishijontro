/**
 * Booking rules — the small decisions and calculations about bookings.
 *
 * Everything here is a pure function (no database), so it is easy to test and the
 * browser can use it too (the booking form, the timeline, the operator's buttons).
 *
 *   1. Groups of statuses: which keep a machine busy, which are finished.
 *   2. The allowed moves between statuses (the life of a booking).
 *   3. Job time: how long a job takes, and when it starts and ends.
 *   4. Codes: the booking code (KJ-2026-000123) and the 4-digit OTP codes.
 *   5. What each person sees next: the farmer's OTP, the operator's next button.
 *   6. Sorting bookings into the groups the lists show.
 *   7. The timeline on a booking's page.
 */
import type { BillingUnit, BookingStatus } from "@/generated/prisma/enums";
import { startOfDhakaDay, toDhakaDay } from "@/lib/services/calendar";

const HOUR_MS = 60 * 60 * 1000;

// ─────────────────────────── 1. Groups of statuses ───────────────────────────

/**
 * Statuses that keep the machine busy: a new booking may not overlap any of them.
 * (A rejected, cancelled or finished booking does not keep the machine busy.)
 */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "OPERATOR_ASSIGNED",
  "ON_THE_WAY",
  "WORKING",
];

/**
 * Statuses where nothing more has to happen soon: the booking never went ahead
 * (rejected, cancelled) or the work is done and paid. Lists show them under "Earlier".
 */
export const FINISHED_BOOKING_STATUSES: BookingStatus[] = ["REJECTED", "CANCELLED", "PAID", "REVIEWED"];

/** True if the booking is in FINISHED_BOOKING_STATUSES. */
export function isBookingFinished(status: BookingStatus): boolean {
  return FINISHED_BOOKING_STATUSES.includes(status);
}

// ─────────────────────────── 2. The allowed moves ───────────────────────────

/**
 * For each status, the statuses that may come next.
 * Example: a REQUESTED booking can become ACCEPTED, REJECTED or CANCELLED, but it can
 * never jump straight to WORKING. Nothing may follow REJECTED, CANCELLED or REVIEWED.
 */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["OPERATOR_ASSIGNED", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
  OPERATOR_ASSIGNED: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["WORKING"], // needs the farmer's start OTP
  WORKING: ["COMPLETED", "BREAKDOWN"], // COMPLETED needs the farmer's finish OTP
  BREAKDOWN: ["COMPLETED", "CANCELLED"], // partly done (a replacement came), or no replacement found
  COMPLETED: ["PAID", "DISPUTED"],
  PAID: ["REVIEWED", "DISPUTED"],
  REVIEWED: [],
  DISPUTED: ["PAID", "REVIEWED"], // after the admin's decision
};

/**
 * True if a booking may move from one status to the other.
 * Example: canChangeStatus("REQUESTED", "ACCEPTED") -> true, canChangeStatus("REQUESTED", "WORKING") -> false
 */
export function canChangeStatus(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// ─────────────────────────── 3. Job time ───────────────────────────

/** A machine rented per acre does about this many hours of work per acre (a rough guess for the calendar). */
export const HOURS_PER_ACRE = 2;

/** Start times a farmer can choose: 6 AM to 5 PM, because field work happens in daylight. */
export const START_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/** The start time the booking form begins with: 8 AM. */
export const DEFAULT_START_HOUR = 8;

/** A booking must start at least this many hours from now, so the provider has time to answer. */
export const MIN_HOURS_BEFORE_START = 2;

/**
 * How many hours the machine is busy with a job (this is what blocks the calendar):
 * - per hour: the hours the farmer asked for
 * - per day:  24 hours for each day (the machine stays with the farmer)
 * - per acre: HOURS_PER_ACRE for each acre, rounded up to whole hours, at least 1 hour
 * Example: estimateWorkHours("PER_ACRE", 0.66) -> 2 (0.66 × 2 = 1.32, rounded up)
 */
export function estimateWorkHours(billingUnit: BillingUnit, quantity: number): number {
  if (billingUnit === "PER_HOUR") {
    return quantity;
  }
  if (billingUnit === "PER_DAY") {
    return quantity * 24;
  }
  return Math.max(1, Math.ceil(quantity * HOURS_PER_ACRE));
}

/**
 * The moment a job starts: the chosen Bangladesh day at the chosen hour.
 * Example: getJobStartAt("2026-10-20", 8) -> 8:00 AM on 20 October in Dhaka (02:00 UTC)
 */
export function getJobStartAt(day: string, startHour: number): Date {
  return new Date(startOfDhakaDay(day).getTime() + startHour * HOUR_MS);
}

/**
 * When a job starts and ends: the chosen day and hour, plus the job length.
 * Example: "2026-10-20", 8 AM, 0.66 acre -> 8:00 to 10:00 AM on 20 October
 */
export function getJobTimeRange(
  day: string,
  startHour: number,
  billingUnit: BillingUnit,
  quantity: number,
): { startAt: Date; endAt: Date } {
  const startAt = getJobStartAt(day, startHour);
  const endAt = new Date(startAt.getTime() + estimateWorkHours(billingUnit, quantity) * HOUR_MS);
  return { startAt, endAt };
}

/** True if the job starts at least MIN_HOURS_BEFORE_START hours after `now`. */
export function isStartFarEnough(startAt: Date, now: Date = new Date()): boolean {
  return startAt.getTime() - now.getTime() >= MIN_HOURS_BEFORE_START * HOUR_MS;
}

// ─────────────────────────── 4. Codes ───────────────────────────

/**
 * The booking code people read out on the phone.
 * The number is padded to 6 digits, so the codes sort in the same order as their numbers.
 * Example: formatBookingCode(2026, 123) -> "KJ-2026-000123"
 */
export function formatBookingCode(year: number, serial: number): string {
  return `KJ-${year}-${String(serial).padStart(6, "0")}`;
}

/**
 * The number inside a booking code (0 if the code looks wrong).
 * Example: readBookingSerial("KJ-2026-000123") -> 123
 */
export function readBookingSerial(code: string): number {
  const serial = Number(code.split("-")[2]);
  return Number.isInteger(serial) ? serial : 0;
}

/** This year in Bangladesh, e.g. 2026. Booking numbers start again from 1 every year. */
export function getBookingYear(now: Date = new Date()): number {
  return Number(toDhakaDay(now).slice(0, 4));
}

/**
 * A random 4-digit code like "0427" for starting or finishing the work.
 * crypto.getRandomValues gives numbers nobody can guess (Math.random could be predicted).
 */
export function generateOtp(): string {
  const [randomNumber] = crypto.getRandomValues(new Uint32Array(1));
  return String(randomNumber % 10000).padStart(4, "0");
}

// ─────────────────────────── 5. What each person sees next ───────────────────────────

/**
 * Which OTP the farmer should see now:
 * - "start" from ACCEPTED until the work starts (the operator needs it to press Start)
 * - "finish" while the work goes on (the operator needs it to press Finish)
 * - null when no code is needed
 */
export function getOtpToShow(status: BookingStatus): "start" | "finish" | null {
  if (status === "ACCEPTED" || status === "OPERATOR_ASSIGNED" || status === "ON_THE_WAY") {
    return "start";
  }
  if (status === "WORKING") {
    return "finish";
  }
  return null;
}

/** The buttons an operator presses, one after another. */
export type OperatorStep = "startTrip" | "arrive" | "startWork" | "finishWork";

/**
 * The operator's next button for a job, or null when there is nothing to do:
 * On the way -> Arrived -> Start (start OTP) -> Finish (finish OTP).
 */
export function getOperatorNextStep(status: BookingStatus, hasArrived: boolean): OperatorStep | null {
  if (status === "OPERATOR_ASSIGNED") {
    return "startTrip";
  }
  if (status === "ON_THE_WAY") {
    return hasArrived ? "startWork" : "arrive";
  }
  if (status === "WORKING") {
    return "finishWork";
  }
  return null;
}

// ─────────────────────────── 6. Groups for the lists ───────────────────────────

/** The two fields the groups need. Any booking object that has them can be grouped. */
type ListedBooking = { status: BookingStatus; startAt: Date };

/** Soonest start first. */
function soonestFirst<T extends ListedBooking>(bookings: T[]): T[] {
  return [...bookings].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** Newest (latest start) first. */
function newestFirst<T extends ListedBooking>(bookings: T[]): T[] {
  return [...bookings].sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
}

/**
 * Splits a farmer's bookings into "current" (soonest first) and "earlier" (newest first).
 * <T extends ListedBooking> means: any booking objects with a status and a startAt;
 * the same objects come back, only sorted into two lists.
 */
export function splitFarmerBookings<T extends ListedBooking>(bookings: T[]): { current: T[]; earlier: T[] } {
  return {
    current: soonestFirst(bookings.filter((booking) => !isBookingFinished(booking.status))),
    earlier: newestFirst(bookings.filter((booking) => isBookingFinished(booking.status))),
  };
}

/**
 * Groups a provider's bookings by what the provider has to do:
 * - requests: new requests to accept or reject
 * - needOperator: accepted, but no operator yet
 * - ongoing: an operator is going there or working (or the machine broke down)
 * - earlier: everything else (newest first)
 */
export function groupProviderBookings<T extends ListedBooking>(bookings: T[]) {
  const ongoingStatuses: BookingStatus[] = ["OPERATOR_ASSIGNED", "ON_THE_WAY", "WORKING", "BREAKDOWN"];
  const handled: BookingStatus[] = ["REQUESTED", "ACCEPTED", ...ongoingStatuses];
  return {
    requests: soonestFirst(bookings.filter((booking) => booking.status === "REQUESTED")),
    needOperator: soonestFirst(bookings.filter((booking) => booking.status === "ACCEPTED")),
    ongoing: soonestFirst(bookings.filter((booking) => ongoingStatuses.includes(booking.status))),
    earlier: newestFirst(bookings.filter((booking) => !handled.includes(booking.status))),
  };
}

/**
 * Groups an operator's jobs (today = the Bangladesh day, "YYYY-MM-DD"):
 * - now: jobs still to do that start today or earlier (a late job stays here until it is done)
 * - coming: jobs still to do on a later day
 * - done: everything else (newest first)
 */
export function groupOperatorJobs<T extends ListedBooking>(jobs: T[], today: string) {
  const toDo = jobs.filter((job) => ACTIVE_BOOKING_STATUSES.includes(job.status));
  return {
    now: soonestFirst(toDo.filter((job) => toDhakaDay(job.startAt) <= today)),
    coming: soonestFirst(toDo.filter((job) => toDhakaDay(job.startAt) > today)),
    done: newestFirst(jobs.filter((job) => !ACTIVE_BOOKING_STATUSES.includes(job.status))),
  };
}

// ─────────────────────────── 7. The timeline ───────────────────────────

/** A step on the timeline: a status, or "ARRIVED" (saved in Booking.arrivedAt, it is not a status). */
export type TimelineKey = BookingStatus | "ARRIVED";

export type TimelineStep = {
  key: TimelineKey;
  done: boolean; // false = a step still to come (shown grey)
  at: Date | null; // when it happened
  actorName: string | null; // who did it
  note: string | null; // e.g. the provider's reason for rejecting
};

/** One BookingStatusLog row, with the name of the person who made the change. */
export type TimelineLog = {
  toStatus: BookingStatus;
  createdAt: Date;
  actorName: string | null;
  note: string | null;
};

/** The normal life of a booking, in order. The grey "still to come" steps are taken from here. */
const NORMAL_PATH: TimelineKey[] = [
  "REQUESTED",
  "ACCEPTED",
  "OPERATOR_ASSIGNED",
  "ON_THE_WAY",
  "ARRIVED",
  "WORKING",
  "COMPLETED",
  "PAID",
  "REVIEWED",
];

/** A booking that stopped here goes no further, so no grey steps follow. */
const STOP_STATUSES: BookingStatus[] = ["REJECTED", "CANCELLED"];

/**
 * Builds the timeline on a booking's page:
 * 1. every status change that happened (the logs, oldest first), with "Arrived"
 *    put right after "On the way" once the operator has arrived;
 * 2. then, unless the booking was rejected or cancelled, the steps still to come (grey).
 */
export function buildTimeline(logs: TimelineLog[], arrivedAt: Date | null, status: BookingStatus): TimelineStep[] {
  const steps: TimelineStep[] = [];
  for (const log of logs) {
    steps.push({ key: log.toStatus, done: true, at: log.createdAt, actorName: log.actorName, note: log.note });
    if (log.toStatus === "ON_THE_WAY" && arrivedAt) {
      // The operator who set off is the one who arrived.
      steps.push({ key: "ARRIVED", done: true, at: arrivedAt, actorName: log.actorName, note: null });
    }
  }

  if (STOP_STATUSES.includes(status)) {
    return steps;
  }

  // Find the furthest step of the normal path reached so far; the steps after it are still to come.
  let furthest = -1;
  for (const step of steps) {
    furthest = Math.max(furthest, NORMAL_PATH.indexOf(step.key));
  }
  for (const key of NORMAL_PATH.slice(furthest + 1)) {
    steps.push({ key, done: false, at: null, actorName: null, note: null });
  }
  return steps;
}
