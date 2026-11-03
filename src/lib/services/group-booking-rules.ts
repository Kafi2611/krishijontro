/**
 * Group booking rules — the math of one machine visiting many members' plots in one village.
 *
 * Everything here is a pure function (no database), so it is easy to test and the group
 * booking form can show the same numbers as the server saves.
 *   1. splitEqually():        the ONE delivery charge shared equally (whole taka, nothing lost)
 *   2. scheduleBackToBack():  plot 1 starts at the chosen time, plot 2 when plot 1 ends, ...
 *   3. shareGroupMinimum():   the minimum charge is checked ONCE, against all plots together
 *   4. priceGroupBooking():   the delivery is worked out once (the machine makes one trip to the
 *                             village), then every plot gets its own bill with its shares
 *   5. countGroupProgress():  how many plots wait, go ahead, are done or stopped (the history list)
 */
import type { BookingStatus } from "@/generated/prisma/enums";
import { calculateBookingPrice, calculateFinalBill, type Bill } from "@/lib/services/pricing";
import type { TimeRange } from "@/lib/services/calendar";

const HOUR_MS = 60 * 60 * 1000;

// ─────────────────────────── 1. Sharing the delivery charge ───────────────────────────

/**
 * Splits an amount into `count` whole-taka parts that add up to EXACTLY the amount.
 * When it does not divide evenly, the first parts get 1 Tk more.
 * Example: splitEqually(250, 3) -> [84, 83, 83]   (84 + 83 + 83 = 250)
 */
export function splitEqually(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const left = total - base * count; // the taka that do not divide evenly
  const parts: number[] = [];
  for (let index = 0; index < count; index++) {
    parts.push(index < left ? base + 1 : base);
  }
  return parts;
}

// ─────────────────────────── 2. One plot after another ───────────────────────────

/**
 * The time of each plot when the machine does them one after another, without a break:
 * the first starts at `startAt`, every next one starts when the one before ends.
 * Example: 8:00 AM with 2 h and 3 h -> 8:00–10:00, then 10:00–1:00 PM
 */
export function scheduleBackToBack(startAt: Date, hoursPerPlot: number[]): TimeRange[] {
  const ranges: TimeRange[] = [];
  let nextStart = startAt.getTime();
  for (const hours of hoursPerPlot) {
    const endAt = nextStart + hours * HOUR_MS;
    ranges.push({ startAt: new Date(nextStart), endAt: new Date(endAt) });
    nextStart = endAt;
  }
  return ranges;
}

// ─────────────────────────── 3. The minimum charge of the group ───────────────────────────

/**
 * The group's minimum charge, checked ONCE for all plots together. The machine is already in
 * the village, so a small plot must not cost the whole minimum on its own:
 * - all plots together reach the minimum -> nobody pays extra (every share is 0), and each
 *   member pays only for their own land
 * - together they are below the minimum -> the missing part of the minimum charge is shared
 *   equally between the members (whole taka, splitEqually)
 * Returns each plot's extra taka (its "minimum share"), in the same order as the plots.
 * Example: 0.3 + 0.4 acre at 2400 Tk/acre, minimum 0.5 acre -> [0, 0]        (0.7 acre is enough)
 *          0.1 + 0.2 acre at 2400 Tk/acre, minimum 0.5 acre -> [240, 240]
 *          (the minimum costs 0.5 × 2400 = 1200; the plots' own work is 240 + 480 = 720; 480 is missing)
 */
export function shareGroupMinimum(quantities: number[], rate: number, minCharge: number): number[] {
  let totalQuantity = 0;
  let ownCharges = 0;
  for (const quantity of quantities) {
    totalQuantity += quantity;
    ownCharges += Math.round(quantity * rate);
  }
  // Compared at 6 decimal places, because 0.1 + 0.2 gives 0.30000000000000004 in JavaScript.
  const reachesMinimum = Math.round(totalQuantity * 1e6) >= Math.round(minCharge * 1e6);
  if (reachesMinimum) {
    return quantities.map(() => 0);
  }
  const missing = Math.max(0, Math.round(minCharge * rate) - ownCharges);
  return splitEqually(missing, quantities.length);
}

// ─────────────────────────── 4. The price of the group ───────────────────────────

/** Everything needed to price a group booking on one machine. */
export type GroupPriceInput = {
  rate: number; // the machine's rate (taka per acre / hour / day)
  minCharge: number; // the smallest quantity billed for the WHOLE group (from the price rule)
  distanceKm: number; // machine -> the village pin
  freeKm: number;
  deliveryRatePerKm: number;
  platformFeePercent: number;
  plots: { quantity: number; subsidyPercent: number }[]; // each member's work, and their own subsidy %
};

/** One plot's bill; its work charge already holds its minimum share (0 when the group reaches the minimum). */
export type GroupPlotBill = Bill & { billedQuantity: number; minimumShare: number };

export type GroupPrice = {
  totalDeliveryCharge: number; // the one trip, before sharing
  bills: GroupPlotBill[]; // one bill per plot, in the same order
};

/**
 * Prices a group booking:
 * 1. the delivery charge of ONE trip (the same formula as a single booking, calculateBookingPrice)
 * 2. shared equally between the plots (splitEqually)
 * 3. the minimum charge checked once for all plots together (shareGroupMinimum)
 * 4. each plot's bill: its own work (no minimum of its own) plus its minimum share, its share of
 *    the delivery and its farmer's own subsidy — the same bill as at the finish (calculateFinalBill).
 * Example: 3 plots of 66 decimal at 2400 Tk/acre, 8 km (3 free, 50 Tk/km), 20% subsidy, 3% fee
 *   -> one trip 250 Tk, shared 84 + 83 + 83; plot 1: work 1584 + delivery 84 − subsidy 317 = 1351 Tk
 *   A 30 decimal plot in that group pays for 30 decimal (720 Tk work), not for the 50 decimal minimum.
 */
export function priceGroupBooking(input: GroupPriceInput): GroupPrice {
  const trip = calculateBookingPrice({
    quantity: 0,
    rate: 0,
    minCharge: 0,
    distanceKm: input.distanceKm,
    freeKm: input.freeKm,
    deliveryRatePerKm: input.deliveryRatePerKm,
    subsidyPercent: 0,
    platformFeePercent: 0,
  });
  const deliveryShares = splitEqually(trip.deliveryCharge, input.plots.length);
  const minimumShares = shareGroupMinimum(
    input.plots.map((plot) => plot.quantity),
    input.rate,
    input.minCharge,
  );

  const bills = input.plots.map((plot, index) => {
    const bill = calculateFinalBill({
      actualQuantity: plot.quantity,
      rate: input.rate,
      minCharge: 0, // no minimum per plot: the group's minimum is in the minimum share
      minimumShare: minimumShares[index],
      deliveryCharge: deliveryShares[index],
      subsidyPercent: plot.subsidyPercent,
      platformFeePercent: input.platformFeePercent,
    });
    return { ...bill, minimumShare: minimumShares[index] };
  });
  return { totalDeliveryCharge: trip.deliveryCharge, bills };
}

// ─────────────────────────── 5. How far a group is ───────────────────────────

/** How many of a group's plots are at each stage, and what the members pay together. */
export type GroupProgress = {
  plots: number;
  waiting: number; // the provider has not answered yet
  going: number; // accepted, on the way or working (or broke down)
  done: number; // the work is finished (paid or not, or a complaint about it)
  stopped: number; // rejected or cancelled
  total: number; // what the members pay together (not counting stopped plots)
};

/** The statuses of a plot whose work is finished. */
const DONE_STATUSES: BookingStatus[] = ["COMPLETED", "PAID", "REVIEWED", "DISPUTED"];

/** The statuses of a plot that will not be worked on. */
const STOPPED_STATUSES: BookingStatus[] = ["REJECTED", "CANCELLED"];

/**
 * Counts a group's plots by stage, for the leader's history list.
 * Example: REQUESTED, ACCEPTED, CANCELLED -> 3 plots: 1 waiting, 1 going, 0 done, 1 stopped
 */
export function countGroupProgress(bookings: { status: BookingStatus; totalAmount: number }[]): GroupProgress {
  const progress: GroupProgress = { plots: bookings.length, waiting: 0, going: 0, done: 0, stopped: 0, total: 0 };
  for (const booking of bookings) {
    if (STOPPED_STATUSES.includes(booking.status)) {
      progress.stopped += 1;
      continue; // a stopped plot is not paid
    }
    if (booking.status === "REQUESTED") {
      progress.waiting += 1;
    } else if (DONE_STATUSES.includes(booking.status)) {
      progress.done += 1;
    } else {
      progress.going += 1;
    }
    progress.total += booking.totalAmount;
  }
  return progress;
}
