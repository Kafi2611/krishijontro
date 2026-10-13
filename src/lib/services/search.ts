/**
 * Search service — finds machines a farmer can rent, and shows one machine to a farmer.
 *
 * searchMachines() works in 7 steps:
 *   1. Which machine types can do the work? (MachineType.workTypes + a price rule today)
 *   2. Load the LISTED machines of those types: machine and provider approved by the
 *      admin, machine ACTIVE, provider account not suspended.
 *   3. Drop machines that cannot take a job now: service is due, or the rate is outside
 *      today's government limit (the limit may have changed after the rate was saved).
 *   4. Work out the distance from each machine to the field (Haversine, geo.ts) and drop
 *      machines farther than the farmer's distance choice.
 *   5. Drop machines that are busy on the chosen day: an active booking or a day the
 *      provider blocked touches that day.
 *   6. Estimate each machine's price for this job (pricing.ts), with the farmer's subsidy.
 *   7. Sort: nearest first (then the more trusted provider), or cheapest first.
 */
import type { WorkType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/services/availability";
import { addDays, blockRangeFromDays, buildDayStrip, toDhakaDay } from "@/lib/services/calendar";
import { BANGLADESH_CENTER, distanceInKm, toDecimal, type LatLng } from "@/lib/services/geo";
import { isMachineListed, isServiceDue } from "@/lib/services/machine-rules";
import { calculateBookingPrice, getBillingQuantity, isRateAllowed, type BookingPrice } from "@/lib/services/pricing";
import { listPricedMachineTypes, type PricedMachineType } from "@/lib/services/pricing-rule";
import { getMachineRatings, listLatestMachineReviews, type MachineRating } from "@/lib/services/review";
import { getPlatformFeePercent } from "@/lib/services/settings";
import { suggestMachineType, type MachineSuggestion } from "@/lib/services/suggest";
import { findUsableSubsidy, type UsableSubsidy } from "@/lib/services/subsidy";
import { DEFAULT_SEARCH_KM, type MachineSearchInput, type SearchSort } from "@/lib/validators/search";

/** How many days the farmer's "free days" row shows. */
export const FREE_DAYS_TO_SHOW = 14;

/** Hours (or days) of work a search starts with, for machines rented by the hour or day. */
export const DEFAULT_HOURS_OR_DAYS = 2;

/** A farmer's job, as the price estimate needs it. */
export type JobDetails = {
  landDecimal: number;
  hoursOrDays: number;
  field: LatLng;
};

/** The estimate for one machine and one job. */
export type JobEstimate = {
  distanceKm: number; // machine -> field
  quantity: number; // acres, hours or days the farmer asked for
  price: BookingPrice;
};

/** One machine in the search results, with everything its card shows. */
export type SearchResult = JobEstimate & {
  id: string;
  brand: string;
  model: string;
  rate: number;
  lat: number;
  lng: number;
  photoUrl: string | null;
  machineType: PricedMachineType;
  location: { name: string; nameBn: string };
  providerName: string;
  trustScore: number;
  rating: MachineRating | null; // null = no reviews yet
};

export type SearchOutcome = {
  results: SearchResult[];
  busyCount: number; // machines that would match but are busy on the chosen day
  subsidy: UsableSubsidy | null; // the farmer's subsidy, already taken off every price
  suggestion: (MachineSuggestion & { machineType: PricedMachineType }) | null;
};

// ─────────────────────────── Pure helpers (no database) ───────────────────────────

/**
 * Estimates the price of one job on one machine:
 * the distance from the machine to the field, the billed quantity and the full price.
 */
export function estimateJob(
  machine: { rate: number; lat: number; lng: number },
  machineType: PricedMachineType,
  job: JobDetails,
  subsidyPercent: number,
  platformFeePercent: number,
): JobEstimate {
  const distanceKm = distanceInKm(machine, job.field);
  const quantity = getBillingQuantity(machineType.billingUnit, job.landDecimal, job.hoursOrDays);
  const price = calculateBookingPrice({
    quantity,
    rate: machine.rate,
    minCharge: machineType.minCharge,
    distanceKm,
    freeKm: machineType.freeKm,
    deliveryRatePerKm: machineType.deliveryRatePerKm,
    subsidyPercent,
    platformFeePercent,
  });
  return { distanceKm, quantity, price };
}

/** The fields the sort needs. Any result with these can be sorted. */
type SortableResult = { distanceKm: number; trustScore: number; price: { totalAmount: number } };

/**
 * Sorts results (returns a new list, the old one is not changed):
 * - "nearest": shortest distance first; same distance -> higher trust score first
 * - "cheapest": lowest total first; same total -> shortest distance first
 */
export function sortSearchResults<T extends SortableResult>(results: T[], sort: SearchSort): T[] {
  // A sort "compare" function: a negative number puts `a` before `b`.
  return [...results].sort((a, b) => {
    if (sort === "cheapest") {
      return a.price.totalAmount - b.price.totalAmount || a.distanceKm - b.distanceKm;
    }
    return a.distanceKm - b.distanceKm || b.trustScore - a.trustScore;
  });
}

// ─────────────────────────── Database helpers ───────────────────────────

/** The where-condition for LISTED machines (the same rule as isMachineListed in machine-rules.ts). */
const LISTED_MACHINE = {
  approvalStatus: "APPROVED",
  status: "ACTIVE",
  provider: { status: "ACTIVE", providerProfile: { approvalStatus: "APPROVED" } },
} as const;

/**
 * Of the given machines, the ones that are busy on a day: an active booking or a
 * blocked range touches that day. Returns their ids as a Set (quick to check).
 */
async function findBusyMachineIds(machineIds: string[], day: string): Promise<Set<string>> {
  const { startAt, endAt } = blockRangeFromDays(day, day); // the whole day, 00:00 to 24:00
  // Two ranges overlap when each one starts before the other one ends.
  const touchesDay = { startAt: { lt: endAt }, endAt: { gt: startAt } };

  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { machineId: { in: machineIds }, status: { in: ACTIVE_BOOKING_STATUSES }, ...touchesDay },
      select: { machineId: true },
    }),
    db.availabilityBlock.findMany({
      where: { machineId: { in: machineIds }, ...touchesDay },
      select: { machineId: true },
    }),
  ]);
  return new Set([...bookings, ...blocks].map((row) => row.machineId));
}

/**
 * The job a farmer starts with before changing anything: their land size from their
 * profile, the centre of their upazila as the field, and DEFAULT_HOURS_OR_DAYS.
 */
export async function getFarmerStartingJob(farmerId: string): Promise<JobDetails> {
  const profile = await db.farmerProfile.findUnique({
    where: { userId: farmerId },
    include: { location: true },
  });
  const upazila = profile?.location;
  const field = upazila?.lat != null && upazila.lng != null ? { lat: upazila.lat, lng: upazila.lng } : BANGLADESH_CENTER;
  const landDecimal = profile && profile.landDecimal > 0 ? profile.landDecimal : 33; // 33 decimal = 1 bigha
  return { landDecimal, hoursOrDays: DEFAULT_HOURS_OR_DAYS, field };
}

/**
 * The search the page starts with: the farmer's starting job, tomorrow, 15 km, nearest first.
 */
export async function getFarmerSearchDefaults(farmerId: string, workType: WorkType): Promise<MachineSearchInput> {
  const job = await getFarmerStartingJob(farmerId);
  return {
    workType,
    machineTypeId: "",
    landValue: job.landDecimal,
    landUnit: "DECIMAL",
    hoursOrDays: job.hoursOrDays,
    day: addDays(toDhakaDay(new Date()), 1), // tomorrow
    lat: job.field.lat,
    lng: job.field.lng,
    maxKm: DEFAULT_SEARCH_KM,
    sort: "nearest",
  };
}

/** Turns a search into the job it describes (land in decimal, the field point). */
export function searchToJob(search: MachineSearchInput): JobDetails {
  return {
    landDecimal: toDecimal(search.landValue, search.landUnit),
    hoursOrDays: search.hoursOrDays,
    field: { lat: search.lat, lng: search.lng },
  };
}

// ─────────────────────────── The search ───────────────────────────

/** Finds and prices the machines for a farmer's job (the 7 steps at the top of this file). */
export async function searchMachines(input: MachineSearchInput, farmerId: string): Promise<SearchOutcome> {
  const job = searchToJob(input);

  // 1. The machine types that can do this work (all of them, or only the one the farmer picked).
  const pricedTypes = await listPricedMachineTypes();
  const typesForWork = pricedTypes.filter((type) => type.workTypes.includes(input.workType));
  const chosenTypes =
    input.machineTypeId === "" ? typesForWork : typesForWork.filter((type) => type.id === input.machineTypeId);
  const typeById = new Map(chosenTypes.map((type) => [type.id, type]));

  // 2. The listed machines of those types.
  const machines = await db.machine.findMany({
    where: { ...LISTED_MACHINE, machineTypeId: { in: chosenTypes.map((type) => type.id) } },
    include: {
      location: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      provider: { select: { name: true, providerProfile: { select: { businessName: true, trustScore: true } } } },
    },
  });

  // 3. Only machines that can take a job now.
  const ready = machines.filter((machine) => {
    const machineType = typeById.get(machine.machineTypeId);
    return machineType !== undefined && !isServiceDue(machine) && isRateAllowed(machine.rate, machineType);
  });

  // 4. Only machines within the farmer's distance.
  const nearby = ready.filter((machine) => distanceInKm(machine, job.field) <= input.maxKm);

  // 5. Only machines that are free on the chosen day.
  const busyIds = await findBusyMachineIds(nearby.map((machine) => machine.id), input.day);
  const free = nearby.filter((machine) => !busyIds.has(machine.id));

  // 6. Estimate each price (with the farmer's subsidy, if any) and add the star rating.
  const [subsidy, platformFeePercent, ratings] = await Promise.all([
    findUsableSubsidy(farmerId),
    getPlatformFeePercent(),
    getMachineRatings(free.map((machine) => machine.id)),
  ]);
  const results: SearchResult[] = free.map((machine) => {
    const machineType = typeById.get(machine.machineTypeId)!; // step 3 kept only machines whose type is known
    const profile = machine.provider.providerProfile;
    return {
      ...estimateJob(machine, machineType, job, subsidy?.discountPercent ?? 0, platformFeePercent),
      id: machine.id,
      brand: machine.brand,
      model: machine.model,
      rate: machine.rate,
      lat: machine.lat,
      lng: machine.lng,
      photoUrl: machine.images[0]?.url ?? null,
      machineType,
      location: machine.location,
      providerName: profile?.businessName ?? machine.provider.name,
      trustScore: profile?.trustScore ?? 0,
      rating: ratings.get(machine.id) ?? null,
    };
  });

  // The suggested machine type for this work and land size (only if that type can do the work).
  const suggested = suggestMachineType(input.workType, job.landDecimal);
  const suggestedType = typesForWork.find((type) => type.name === suggested?.machineTypeName);

  // 7. Sort.
  return {
    results: sortSearchResults(results, input.sort),
    busyCount: nearby.length - free.length,
    subsidy,
    suggestion: suggested && suggestedType ? { ...suggested, machineType: suggestedType } : null,
  };
}

// ─────────────────────────── One machine, for the farmer ───────────────────────────

/**
 * Everything the farmer's machine page shows: the machine (only if it is listed),
 * whether it can take a job now, the price estimate for the farmer's job, the star
 * rating with the latest reviews, and which of the next 14 days are free.
 * Returns null if the machine does not exist or farmers may not see it.
 */
export async function getMachineForFarmer(machineId: string, farmerId: string, job: JobDetails) {
  const machine = await db.machine.findUnique({
    where: { id: machineId },
    include: {
      machineType: true,
      location: { include: { parent: true } }, // upazila + its district
      images: { orderBy: { sortOrder: "asc" } },
      provider: {
        select: {
          name: true,
          status: true,
          providerProfile: { select: { businessName: true, providerType: true, trustScore: true, approvalStatus: true } },
        },
      },
    },
  });
  const profile = machine?.provider.providerProfile;
  if (!machine || !profile || machine.provider.status !== "ACTIVE") {
    return null;
  }
  const listed = isMachineListed({
    approvalStatus: machine.approvalStatus,
    status: machine.status,
    providerApprovalStatus: profile.approvalStatus,
  });
  if (!listed) {
    return null;
  }

  const today = toDhakaDay(new Date());
  const lastDay = addDays(today, FREE_DAYS_TO_SHOW);
  const stripRange = { startAt: { lt: blockRangeFromDays(lastDay, lastDay).startAt }, endAt: { gt: new Date() } };

  const [pricedTypes, subsidy, platformFeePercent, ratings, latestReviews, bookings, blocks] = await Promise.all([
    listPricedMachineTypes(),
    findUsableSubsidy(farmerId),
    getPlatformFeePercent(),
    getMachineRatings([machine.id]),
    listLatestMachineReviews(machine.id),
    db.booking.findMany({
      where: { machineId, status: { in: ACTIVE_BOOKING_STATUSES }, ...stripRange },
      select: { startAt: true, endAt: true },
    }),
    db.availabilityBlock.findMany({ where: { machineId, ...stripRange }, select: { startAt: true, endAt: true } }),
  ]);

  // No price rule today -> no estimate, and the machine cannot be booked.
  const pricedType = pricedTypes.find((type) => type.id === machine.machineTypeId) ?? null;
  const estimate = pricedType
    ? estimateJob(machine, pricedType, job, subsidy?.discountPercent ?? 0, platformFeePercent)
    : null;
  const canTakeJobs = pricedType !== null && !isServiceDue(machine) && isRateAllowed(machine.rate, pricedType);

  return {
    machine,
    providerName: profile.businessName ?? machine.provider.name,
    providerType: profile.providerType,
    trustScore: profile.trustScore,
    pricedType,
    canTakeJobs,
    estimate,
    subsidy,
    rating: ratings.get(machine.id) ?? null,
    latestReviews,
    freeDays: buildDayStrip(today, FREE_DAYS_TO_SHOW, { booked: bookings, blocked: blocks }),
  };
}
