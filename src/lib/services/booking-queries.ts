/**
 * Booking queries — reading bookings for each person's pages (booking.ts does the changes).
 *
 * Safety:
 * - Every function takes the user's id and only finds THAT user's bookings: the farmer's
 *   own bookings, the bookings of the provider's machines, the operator's own jobs.
 * - The two OTP codes are secret: only the farmer's booking page reads them. Every other
 *   query leaves them out with Prisma's "omit" (SECRET_CODES), so they can never reach the
 *   provider's or the operator's screen.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus, WorkType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  ACTIVE_BOOKING_STATUSES,
  buildTimeline,
  DEFAULT_START_HOUR,
  getOtpToShow,
  groupProviderBookings,
  splitFarmerBookings,
} from "@/lib/services/booking-rules";
import { addDays, toDhakaDay, type TimeRange } from "@/lib/services/calendar";
import { listUpazilaOptions } from "@/lib/services/location";
import { getFarmerStartingJob, getMachineForFarmer, searchToJob } from "@/lib/services/search";
import { getPlatformFeePercent } from "@/lib/services/settings";
import type { BookingInput } from "@/lib/validators/booking";
import type { MachineSearchInput } from "@/lib/validators/search";

// ─────────────────────────── Shared parts ───────────────────────────

/** Leaves the two OTP codes out of a query's result (Prisma "omit"). */
const SECRET_CODES = { startOtp: true, finishOtp: true } satisfies Prisma.BookingOmit;

/** The machine fields a booking card shows: its name and its type's icon. */
const MACHINE_FOR_CARD = {
  select: { brand: true, model: true, machineType: { select: { name: true, nameBn: true, icon: true } } },
} satisfies Prisma.MachineDefaultArgs;

/** A booking's history rows, oldest first, with the name of the person who made each change. */
const STATUS_LOGS = {
  include: { actor: { select: { name: true } } },
  orderBy: { createdAt: "asc" },
} satisfies Prisma.Booking$statusLogsArgs;

/** A booking with its history rows, as the timeline needs it. */
type BookingWithLogs = {
  status: BookingStatus;
  arrivedAt: Date | null;
  statusLogs: { toStatus: BookingStatus; createdAt: Date; note: string | null; actor: { name: string } | null }[];
};

/** Turns a booking's history rows into the steps of its timeline (buildTimeline in booking-rules.ts). */
function timelineOf(booking: BookingWithLogs) {
  const logs = booking.statusLogs.map((log) => ({
    toStatus: log.toStatus,
    createdAt: log.createdAt,
    actorName: log.actor?.name ?? null,
    note: log.note,
  }));
  return buildTimeline(logs, booking.arrivedAt, booking.status);
}

// ─────────────────────────── The farmer ───────────────────────────

/** The farmer's bookings, split into "current" (soonest first) and "earlier" (newest first). */
export async function listFarmerBookings(farmerId: string) {
  const bookings = await db.booking.findMany({
    where: { farmerId },
    include: { machine: MACHINE_FOR_CARD },
    omit: SECRET_CODES, // the list does not show the codes
  });
  return splitFarmerBookings(bookings);
}

/**
 * One of the farmer's OWN bookings with everything its page shows — including the OTP codes,
 * because the farmer is the one who gives them to the operator. Returns null for anyone else's booking.
 */
export async function getFarmerBooking(bookingId: string, farmerId: string) {
  const booking = await db.booking.findFirst({
    where: { id: bookingId, farmerId },
    include: {
      machine: {
        select: {
          brand: true,
          model: true,
          machineType: { select: { name: true, nameBn: true, icon: true } },
          provider: { select: { name: true, phone: true, providerProfile: { select: { businessName: true } } } },
        },
      },
      operator: { select: { name: true, phone: true } },
      subsidyApplication: { select: { program: { select: { discountPercent: true } } } },
      statusLogs: STATUS_LOGS,
    },
  });
  if (!booking) {
    return null;
  }
  return { booking, timeline: timelineOf(booking), otp: codeToShow(booking) };
}

/**
 * The code the farmer must see right now: the start code until the work begins, then the
 * finish code (getOtpToShow in booking-rules.ts decides). Null when no code is needed.
 */
function codeToShow(booking: { status: BookingStatus; startOtp: string | null; finishOtp: string | null }) {
  const kind = getOtpToShow(booking.status);
  const code = kind === "start" ? booking.startOtp : booking.finishOtp;
  if (!kind || !code) {
    return null;
  }
  return { kind, code };
}

// ─────────────────────────── The provider ───────────────────────────

/** How many of the "Earlier" bookings the provider's list shows. */
const EARLIER_TO_SHOW = 30;

/**
 * The bookings of the provider's machines, grouped by what the provider has to do
 * (groupProviderBookings in booking-rules.ts). The OTP codes are left out.
 */
export async function listProviderBookings(providerId: string) {
  const bookings = await db.booking.findMany({
    where: { machine: { providerId } },
    include: { machine: MACHINE_FOR_CARD, farmer: { select: { name: true } } },
    omit: SECRET_CODES,
  });
  const groups = groupProviderBookings(bookings);
  return { ...groups, earlier: groups.earlier.slice(0, EARLIER_TO_SHOW) };
}

/**
 * One booking of one of the provider's OWN machines, with everything its page shows,
 * or null for anyone else's booking. The OTP codes are left out: only the farmer has them.
 */
export async function getProviderBooking(bookingId: string, providerId: string) {
  const booking = await db.booking.findFirst({
    where: { id: bookingId, machine: { providerId } },
    omit: SECRET_CODES,
    include: {
      machine: { select: { brand: true, model: true, machineType: { select: { name: true, nameBn: true, icon: true } } } },
      farmer: { select: { name: true, phone: true } },
      operator: { select: { name: true, phone: true } },
      statusLogs: STATUS_LOGS,
    },
  });
  if (!booking) {
    return null;
  }
  return { booking, timeline: timelineOf(booking) };
}

// ─────────────────────────── The booking form ───────────────────────────

/** The machine, as the booking form shows it (only plain values, so it can be sent to the browser). */
export type BookingFormMachine = {
  id: string;
  name: string; // e.g. "Mahindra 575 DI"
  rate: number;
  lat: number;
  lng: number;
  icon: string;
  typeName: string;
  typeNameBn: string;
  workTypes: WorkType[]; // the work this machine can do
};

/** When the machine is busy from now on (active bookings and blocked times). The form greys these out. */
async function listMachineBusyTimes(machineId: string): Promise<TimeRange[]> {
  const notOverYet = { endAt: { gt: new Date() } };
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { machineId, status: { in: ACTIVE_BOOKING_STATUSES }, ...notOverYet },
      select: { startAt: true, endAt: true },
    }),
    db.availabilityBlock.findMany({ where: { machineId, ...notOverYet }, select: { startAt: true, endAt: true } }),
  ]);
  return [...bookings, ...blocks];
}

/**
 * Everything the 3-step booking form needs: the machine, today's price rule, the farmer's
 * subsidy, the busy times, the upazilas (for "go to upazila") and the values the form
 * starts with — the farmer's search if they came from it, otherwise their own land and
 * upazila, tomorrow at 8 AM. Returns null if farmers may not see this machine.
 */
export async function getBookingFormData(machineId: string, farmerId: string, search: MachineSearchInput | null) {
  const job = search ? searchToJob(search) : await getFarmerStartingJob(farmerId);
  const details = await getMachineForFarmer(machineId, farmerId, job);
  if (!details) {
    return null;
  }
  const { machine } = details;
  const formMachine: BookingFormMachine = {
    id: machine.id,
    name: `${machine.brand} ${machine.model}`,
    rate: machine.rate,
    lat: machine.lat,
    lng: machine.lng,
    icon: machine.machineType.icon,
    typeName: machine.machineType.name,
    typeNameBn: machine.machineType.nameBn,
    workTypes: machine.machineType.workTypes,
  };

  const [busyTimes, platformFeePercent, upazilas] = await Promise.all([
    listMachineBusyTimes(machineId),
    getPlatformFeePercent(),
    listUpazilaOptions(),
  ]);

  const workTypes = formMachine.workTypes;
  const defaultValues: BookingInput = {
    machineId,
    // Keep the searched work only if this machine can do it.
    workType: search && workTypes.includes(search.workType) ? search.workType : workTypes[0],
    landValue: search?.landValue ?? job.landDecimal,
    landUnit: search?.landUnit ?? "DECIMAL",
    hoursOrDays: job.hoursOrDays,
    lat: job.field.lat,
    lng: job.field.lng,
    fieldAddress: "",
    day: search?.day ?? addDays(toDhakaDay(new Date()), 1),
    startHour: DEFAULT_START_HOUR,
    note: "",
  };

  return {
    // The search's rules: a price rule today, no service due, rate inside the limit.
    canBook: details.canTakeJobs,
    machine: formMachine,
    pricedType: details.pricedType,
    subsidyPercent: details.subsidy?.discountPercent ?? 0,
    platformFeePercent,
    busyTimes,
    upazilas,
    defaultValues,
  };
}
