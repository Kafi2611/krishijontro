/**
 * Stats rules — small pure helpers that turn database rows into chart data.
 *
 * Everything here is a pure function (no database), so it is easy to test.
 *   1. lastMonths():  the last N months as "YYYY-MM" (Bangladesh time), oldest first
 *   2. sumByMonth():  adds amounts into those months; months with nothing get 0
 *   3. sumByKey():    adds amounts by any name (machine, district, role...), biggest first
 *   4. heatLevel():   which of the 5 colour steps a number gets on the demand heatmap
 *   5. monthMiddle(): a date inside a month, to print the month's name
 *   6. niceTicks():   clean numbers for a chart's value axis (0, 100, 200...)
 *   7. buildDemandPlaces(): bookings and waiting farmers per upazila, for the demand heatmap
 */
import { addMonths, toDhakaDay } from "@/lib/services/calendar";

/** One bar of a chart: what it is called (a key; the page turns it into words) and its value. */
export type ChartPoint = { key: string; value: number };

/**
 * The last `count` months, oldest first, ending with this month (Bangladesh time).
 * Example: on 3 Nov 2026, lastMonths(3) -> ["2026-09", "2026-10", "2026-11"]
 */
export function lastMonths(count: number, now: Date = new Date()): string[] {
  const thisMonth = toDhakaDay(now).slice(0, 7);
  const months: string[] = [];
  for (let back = count - 1; back >= 0; back--) {
    months.push(addMonths(thisMonth, -back));
  }
  return months;
}

/**
 * Adds each row's amount into the month of its date (Bangladesh time). Every month in
 * `months` appears once, in order, with 0 when nothing happened; rows outside are ignored.
 * Example: months ["2026-10", "2026-11"], rows 5 Oct 100 Tk and 7 Oct 50 Tk
 *          -> [{ key: "2026-10", value: 150 }, { key: "2026-11", value: 0 }]
 */
export function sumByMonth(rows: { date: Date; amount: number }[], months: string[]): ChartPoint[] {
  const totals = new Map(months.map((month) => [month, 0]));
  for (const row of rows) {
    const month = toDhakaDay(row.date).slice(0, 7);
    const total = totals.get(month);
    if (total !== undefined) {
      totals.set(month, total + row.amount);
    }
  }
  return months.map((month) => ({ key: month, value: totals.get(month) ?? 0 }));
}

/**
 * Adds amounts by name, biggest first (same value: A to Z), keeping at most `limit` names.
 * Example: [{ key: "Rajshahi", amount: 1 }, { key: "Dhaka", amount: 1 }, { key: "Rajshahi", amount: 1 }]
 *          -> [{ key: "Rajshahi", value: 2 }, { key: "Dhaka", value: 1 }]
 */
export function sumByKey(rows: { key: string; amount: number }[], limit = 10): ChartPoint[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.key, (totals.get(row.key) ?? 0) + row.amount);
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/** The heatmap has 5 colour steps, from light (a little demand) to dark (the most). */
export const HEAT_LEVELS = 5;

/**
 * Which colour step (0 = lightest … 4 = darkest) a value gets, out of the biggest value on the
 * map: the range 1..max is cut into 5 equal parts. 0 demand is not drawn, so it is not counted.
 * Example: max 10 -> 1-2 step 0, 3-4 step 1, 5-6 step 2, 7-8 step 3, 9-10 step 4
 */
export function heatLevel(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  const level = Math.ceil((value / max) * HEAT_LEVELS) - 1;
  return Math.min(HEAT_LEVELS - 1, Math.max(0, level));
}

/**
 * The lowest and highest whole value of each heatmap step, for the legend (the same cut points
 * as heatLevel). A step that no whole number falls into is null (the legend leaves it out).
 * Example: max 10 -> [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]
 *          max 3  -> [null, [1, 1], null, [2, 2], [3, 3]]
 */
export function heatLevelRanges(max: number): ([number, number] | null)[] {
  const ranges: ([number, number] | null)[] = [];
  for (let level = 0; level < HEAT_LEVELS; level++) {
    // Values v with level*max/5 < v <= (level+1)*max/5 get this step.
    const from = Math.floor((level * max) / HEAT_LEVELS) + 1;
    const to = Math.floor(((level + 1) * max) / HEAT_LEVELS);
    ranges.push(from <= to ? [from, to] : null);
  }
  return ranges;
}

/**
 * A moment in the middle of a month, so a page can print the month's name in any language
 * (the 15th at noon in Dhaka is the same month everywhere in the world).
 * Example: monthMiddle("2026-10") -> 15 Oct 2026, 12:00 in Dhaka
 */
export function monthMiddle(month: string): Date {
  return new Date(`${month}-15T06:00:00Z`);
}

/**
 * Clean numbers for a chart's value axis: 0 and 4 equal steps, the step a "round" number
 * (1, 1.5, 2, 2.5, 3 or 5 times a power of 10, and always whole), the last one at least `max`.
 * Example: max 370 -> [0, 100, 200, 300, 400]; max 18 -> [0, 5, 10, 15, 20]; max 0 -> [0, 1]
 */
export function niceTicks(max: number, steps = 4): number[] {
  if (max <= 0) {
    return [0, 1];
  }
  const rough = max / steps;
  const power = 10 ** Math.floor(Math.log10(rough));
  const candidates = [1, 1.5, 2, 2.5, 3, 5, 10].map((multiple) => multiple * power).filter((step) => Number.isInteger(step));
  const step = candidates.find((candidate) => candidate >= rough) ?? Math.ceil(rough);
  const ticks: number[] = [];
  for (let index = 0; index <= steps; index++) {
    ticks.push(index * step);
  }
  return ticks;
}

/** One upazila on the demand heatmap. */
export type DemandPlace = {
  id: string;
  name: string;
  nameBn: string;
  lat: number;
  lng: number;
  bookings: number; // bookings that went ahead for fields here
  waiting: number; // farmers here still on the waitlist
  demand: number; // bookings + waiting
};

/** A booking or a waitlist entry, with the upazila it is in (its centre may be unknown). */
export type DemandRow = {
  kind: "booking" | "waiting";
  placeId: string;
  place: { name: string; nameBn: string; lat: number | null; lng: number | null };
};

/**
 * Groups bookings and waiting farmers by upazila for the heatmap: one entry per upazila with a
 * centre point (others cannot be drawn), the most demand first.
 * Example: 2 bookings + 1 waiting farmer in Paba -> { name: "Paba", bookings: 2, waiting: 1, demand: 3 }
 */
export function buildDemandPlaces(rows: DemandRow[]): DemandPlace[] {
  const places = new Map<string, DemandPlace>();
  for (const row of rows) {
    const { lat, lng } = row.place;
    if (lat === null || lng === null) {
      continue;
    }
    let place = places.get(row.placeId);
    if (!place) {
      place = { id: row.placeId, name: row.place.name, nameBn: row.place.nameBn, lat, lng, bookings: 0, waiting: 0, demand: 0 };
      places.set(row.placeId, place);
    }
    if (row.kind === "booking") {
      place.bookings += 1;
    } else {
      place.waiting += 1;
    }
    place.demand += 1;
  }
  return [...places.values()].sort((a, b) => b.demand - a.demand || a.name.localeCompare(b.name));
}
