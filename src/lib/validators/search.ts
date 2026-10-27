// Zod rules for the farmer's machine search, and helpers to keep the search in the
// page address (URL), e.g. /farmer/search?workType=TILLING&landValue=66&...
// Keeping it in the URL means: the Back button works, the page can be reloaded or
// shared, and the server reads the search straight from the address.
// The same rules run in the browser (the form) and on the server (the page).
import { z } from "zod";
import { WorkType } from "@/generated/prisma/enums";
import { numberFromInput } from "@/lib/form-values";
import { addDays, DAY_REGEX, toDhakaDay } from "@/lib/services/calendar";
import { BANGLADESH_BOUNDS, LAND_UNITS } from "@/lib/services/geo";

/** The distance choices (km) a farmer can pick. */
export const SEARCH_DISTANCES_KM = [5, 10, 15, 25, 50] as const;

/** Search this far around the field when the farmer has not chosen. */
export const DEFAULT_SEARCH_KM = 15;

/** Hours (or days) of work a search starts with, for machines rented by the hour or day. */
export const DEFAULT_HOURS_OR_DAYS = 2;

/** Farmers can search (and later book) up to this many days ahead. */
export const MAX_DAYS_AHEAD = 60;

/** How the results are ordered. */
export const SEARCH_SORTS = ["nearest", "cheapest"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const machineSearchSchema = z
  .object({
    workType: z.enum(WorkType, "required"), // e.g. "TILLING"
    machineTypeId: z.string(), // "" means: any machine that can do this work
    landValue: z.number("numberInvalid").positive("numberInvalid").max(10000, "numberInvalid"),
    landUnit: z.enum(LAND_UNITS),
    hoursOrDays: z.number("numberInvalid").positive("numberInvalid").max(240, "numberInvalid"), // only for machines rented per hour / day
    day: z.string().regex(DAY_REGEX, "dateInvalid"), // the day the work should be done, "2026-10-20"
    lat: z
      .number("pickOnMap")
      .min(BANGLADESH_BOUNDS.minLat, "outsideBangladesh")
      .max(BANGLADESH_BOUNDS.maxLat, "outsideBangladesh"),
    lng: z
      .number("pickOnMap")
      .min(BANGLADESH_BOUNDS.minLng, "outsideBangladesh")
      .max(BANGLADESH_BOUNDS.maxLng, "outsideBangladesh"),
    maxKm: z.number("numberInvalid").int("numberInvalid").min(1, "numberInvalid").max(50, "numberInvalid"),
    sort: z.enum(SEARCH_SORTS),
  })
  // "YYYY-MM-DD" text sorts like dates, so we can compare days with >= and <=
  .refine((search) => search.day >= toDhakaDay(new Date()), {
    message: "dayInPast",
    path: ["day"],
  })
  .refine((search) => search.day <= addDays(toDhakaDay(new Date()), MAX_DAYS_AHEAD), {
    message: "dayTooFar",
    path: ["day"],
  });

export type MachineSearchInput = z.infer<typeof machineSearchSchema>;

/** The search fields that hold numbers (everything else is text). */
const NUMBER_FIELDS = ["landValue", "hoursOrDays", "lat", "lng", "maxKm"];

/**
 * Turns a search into the text after "?" in the page address.
 * Example: { workType: "TILLING", landValue: 66, ... } -> "workType=TILLING&landValue=66&..."
 */
export function searchInputToQuery(input: MachineSearchInput): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(input)) {
    params.set(name, String(value));
  }
  return params.toString();
}

/**
 * Reads a search from the page address. Every value arrives as text, so number fields
 * are turned into numbers first; then the same Zod rules as the form check everything.
 * Returns null if anything is missing or wrong (for example someone edited the address).
 */
export function searchParamsToInput(
  params: Record<string, string | string[] | undefined>,
): MachineSearchInput | null {
  const values: Record<string, unknown> = {};
  for (const name of Object.keys(machineSearchSchema.shape)) {
    const raw = params[name];
    const text = Array.isArray(raw) ? raw[0] : raw; // ?a=1&a=2 gives a list; we use the first
    values[name] = NUMBER_FIELDS.includes(name) ? numberFromInput(text) : (text ?? "");
  }
  const parsed = machineSearchSchema.safeParse(values);
  return parsed.success ? parsed.data : null;
}
