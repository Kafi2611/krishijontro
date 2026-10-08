/**
 * Calendar service — pure date helpers for the availability calendar
 * (and, in Phase 4, for checking that two bookings do not overlap).
 *
 * Two ideas to know:
 * 1. A "day" is written as text "YYYY-MM-DD" (what <input type="date"> gives us).
 *    Bangladesh time is always UTC+6 (no summer time), so the Bangladesh day
 *    "2026-10-08" starts at 2026-10-08 00:00 in Dhaka = 2026-10-07 18:00 UTC.
 * 2. A time range is [start, end): the start is included, the end is NOT.
 *    So a block from Monday 00:00 to Tuesday 00:00 covers exactly Monday.
 *
 * No database here, so everything is easy to test.
 */

/** Bangladesh is 6 hours ahead of UTC all year. */
const DHAKA_OFFSET_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Text like "2026-10-08". */
export const DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Text like "2026-10". */
export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The moment a Bangladesh day starts.
 * Example: startOfDhakaDay("2026-10-08") -> 2026-10-07T18:00:00.000Z
 */
export function startOfDhakaDay(day: string): Date {
  return new Date(`${day}T00:00:00+06:00`);
}

/**
 * The Bangladesh day (as "YYYY-MM-DD") of a moment.
 * Example: toDhakaDay(new Date("2026-10-07T19:00:00Z")) -> "2026-10-08" (it is 1 AM in Dhaka)
 */
export function toDhakaDay(date: Date): string {
  const dhakaTime = new Date(date.getTime() + DHAKA_OFFSET_HOURS * HOUR_MS);
  return dhakaTime.toISOString().slice(0, 10);
}

/**
 * Moves a day forward (or back, with a negative number) by whole days.
 * Example: addDays("2026-10-31", 1) -> "2026-11-01"
 */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * How many days from `fromDay` to `toDay`, counting both.
 * Example: countDays("2026-10-08", "2026-10-10") -> 3
 */
export function countDays(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(toDay) - Date.parse(fromDay)) / DAY_MS) + 1;
}

/**
 * Moves a month forward or back.
 * Example: addMonths("2026-12", 1) -> "2027-01"
 */
export function addMonths(month: string, months: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 7);
}

/**
 * True if two time ranges share any moment. End times are NOT included,
 * so 08:00–12:00 and 12:00–15:00 do not overlap (one job can end as the next starts).
 */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Turns "block from day X to day Y (both included)" into a time range [startAt, endAt).
 * Example: "2026-10-10" to "2026-10-11" -> 10 Oct 00:00 until 12 Oct 00:00 (Dhaka time)
 */
export function blockRangeFromDays(fromDay: string, toDay: string): { startAt: Date; endAt: Date } {
  return { startAt: startOfDhakaDay(fromDay), endAt: startOfDhakaDay(addDays(toDay, 1)) };
}

// ─────────────────────────── The month grid ───────────────────────────

export type TimeRange = { startAt: Date; endAt: Date };

/** What a day looks like on the calendar. "booked" wins over "blocked". */
export type DayState = "past" | "booked" | "blocked" | "free";

export type CalendarDay = {
  day: string; // "2026-10-08"
  dayOfMonth: number; // 8
  inMonth: boolean; // false for the grey days of the previous/next month
  isToday: boolean;
  state: DayState;
};

/** True if any of the ranges touches the given Bangladesh day. */
function dayIsCovered(day: string, ranges: TimeRange[]): boolean {
  const dayStart = startOfDhakaDay(day);
  const dayEnd = startOfDhakaDay(addDays(day, 1));
  return ranges.some((range) => rangesOverlap(dayStart, dayEnd, range.startAt, range.endAt));
}

/** Decides how one day is shown. */
function dayState(day: string, today: string, booked: TimeRange[], blocked: TimeRange[]): DayState {
  if (day < today) {
    return "past"; // "YYYY-MM-DD" text sorts like dates, so < works
  }
  if (dayIsCovered(day, booked)) {
    return "booked";
  }
  if (dayIsCovered(day, blocked)) {
    return "blocked";
  }
  return "free";
}

/**
 * The first and last day shown on a month's grid. Weeks start on Sunday, so the grid
 * starts on the Sunday on or before the 1st and ends on the Saturday on or after the last day.
 * Example: October 2026 (1 Oct is a Thursday) -> "2026-09-27" to "2026-10-31"
 */
export function monthGridRange(month: string): { firstDay: string; lastDay: string } {
  const firstOfMonth = `${month}-01`;
  const lastOfMonth = addDays(`${addMonths(month, 1)}-01`, -1);
  const weekdayOfFirst = new Date(`${firstOfMonth}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const weekdayOfLast = new Date(`${lastOfMonth}T00:00:00Z`).getUTCDay();
  return {
    firstDay: addDays(firstOfMonth, -weekdayOfFirst),
    lastDay: addDays(lastOfMonth, 6 - weekdayOfLast),
  };
}

/**
 * Builds a month for the calendar: a list of weeks, each a list of 7 days,
 * with every day marked past / booked / blocked / free.
 */
export function buildMonthGrid(
  month: string,
  today: string,
  busy: { booked: TimeRange[]; blocked: TimeRange[] },
): CalendarDay[][] {
  const { firstDay, lastDay } = monthGridRange(month);
  const weeks: CalendarDay[][] = [];

  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
    // Start a new row every 7 days
    if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) {
      weeks.push([]);
    }
    weeks[weeks.length - 1].push({
      day,
      dayOfMonth: Number(day.slice(8, 10)),
      inMonth: day.startsWith(month),
      isToday: day === today,
      state: dayState(day, today, busy.booked, busy.blocked),
    });
  }
  return weeks;
}
