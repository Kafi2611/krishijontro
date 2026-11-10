// Unit tests for src/lib/services/breakdown-rules.ts: the work left after a breakdown, the
// replacement job's time, the two bills (they must add up to the normal price) and the order
// of the replacement machines.
import { describe, expect, it } from "vitest";
import {
  billReplacement,
  billWorkDone,
  getBookedAmount,
  getDoneQuantity,
  getRemainingWork,
  getReplacementDeadline,
  getReplacementTimeRange,
  isDoneAmountValid,
  sortReplacementMachines,
  splitMinimumShare,
} from "@/lib/services/breakdown-rules";

// The project's price example: 66 decimal of tilling at 2400 Tk/acre, 250 Tk delivery.
const tilling = { billingUnit: "PER_ACRE" as const, landDecimal: 66, quantity: 0.66, rateSnapshot: 2400, deliveryCharge: 250 };
// An irrigation pump booked for 6 hours on a 100 decimal field.
const pump = { billingUnit: "PER_HOUR" as const, landDecimal: 100, quantity: 6 };
const percents = { subsidyPercent: 20, platformFeePercent: 3 };

describe("the work before and after a breakdown", () => {
  it("reads the booked work in the operator's unit: decimal for land, otherwise hours or days", () => {
    expect(getBookedAmount(tilling)).toBe(66);
    expect(getBookedAmount(pump)).toBe(6);
  });

  it("accepts work done from 0 up to (not including) what was booked", () => {
    expect(isDoneAmountValid(tilling, 0)).toBe(true);
    expect(isDoneAmountValid(tilling, 40)).toBe(true);
    expect(isDoneAmountValid(tilling, 66)).toBe(false); // all done: press Finish instead
    expect(isDoneAmountValid(tilling, -1)).toBe(false);
  });

  it("turns the work done into the billing unit", () => {
    expect(getDoneQuantity("PER_ACRE", 40)).toBe(0.4);
    expect(getDoneQuantity("PER_HOUR", 2.5)).toBe(2.5);
  });

  it("leaves the rest of the land, or the rest of the hours, for the replacement", () => {
    expect(getRemainingWork(tilling, 0.4)).toEqual({ landDecimal: 26, quantity: 0.26 });
    expect(getRemainingWork(tilling, 0.403)).toEqual({ landDecimal: 25.7, quantity: 0.26 });
    expect(getRemainingWork(pump, 2)).toEqual({ landDecimal: 100, quantity: 4 });
  });
});

describe("the replacement job's time", () => {
  it("starts 1 hour from now and lasts as long as the work left takes", () => {
    const now = new Date("2026-10-20T04:00:00Z"); // 10:00 AM in Dhaka
    const range = getReplacementTimeRange("PER_ACRE", 0.26, now);
    expect(range.startAt.toISOString()).toBe("2026-10-20T05:00:00.000Z");
    expect(range.endAt.toISOString()).toBe("2026-10-20T06:00:00.000Z"); // 0.26 acre -> 1 hour
  });

  it("lets the admin give up 2 hours after the breakdown", () => {
    const reportedAt = new Date("2026-10-20T04:00:00Z");
    expect(getReplacementDeadline(reportedAt, 2).toISOString()).toBe("2026-10-20T06:00:00.000Z");
  });
});

describe("the two bills of a breakdown", () => {
  it("bills the broken machine only for the work it did, plus its delivery", () => {
    expect(billWorkDone(tilling, 0.4, percents)).toEqual({
      workCharge: 960,
      deliveryCharge: 250,
      subsidyAmount: 192,
      totalAmount: 1018,
      platformFee: 36,
      providerAmount: 1174,
    });
  });

  it("bills the replacement for the rest at the booked rate, with free delivery", () => {
    expect(billReplacement(tilling, 0.26, percents)).toEqual({
      workCharge: 624,
      deliveryCharge: 0,
      subsidyAmount: 125,
      totalAmount: 499,
      platformFee: 19,
      providerAmount: 605,
    });
  });

  it("makes the farmer pay the same as without a breakdown (1018 + 499 = 1517)", () => {
    const total = billWorkDone(tilling, 0.4, percents).totalAmount + billReplacement(tilling, 0.26, percents).totalAmount;
    expect(total).toBe(1517);
  });

  it("does not use the minimum charge: no work done means only the delivery", () => {
    expect(billWorkDone(tilling, 0, percents).totalAmount).toBe(250);
  });
});

describe("a group plot's minimum share after a breakdown", () => {
  // A small group plot: 10 decimal (0.1 acre) at 1500 Tk/acre = 150 Tk of own work, plus a
  // 100 Tk share of the group's minimum charge, and a 50 Tk share of the one trip.
  const groupPlot = { rateSnapshot: 1500, deliveryCharge: 50, minimumShare: 100, quantity: 0.1 };
  const noSubsidy = { subsidyPercent: 0, platformFeePercent: 3 };

  it("splits the share in proportion to the work each machine does", () => {
    expect(splitMinimumShare(groupPlot, 0.04)).toEqual({ doneShare: 40, replacementShare: 60 });
    expect(splitMinimumShare(groupPlot, 0.05)).toEqual({ doneShare: 50, replacementShare: 50 });
  });

  it("never loses or adds a taka: the two parts are always the whole share", () => {
    const shares = splitMinimumShare({ minimumShare: 37, quantity: 0.1 }, 0.033);
    expect(shares).toEqual({ doneShare: 12, replacementShare: 25 });
    expect(shares.doneShare + shares.replacementShare).toBe(37);
  });

  it("gives the whole share to the replacement when no work was done", () => {
    expect(splitMinimumShare(groupPlot, 0)).toEqual({ doneShare: 0, replacementShare: 100 });
  });

  it("is 0 for a booking that is not a group plot", () => {
    expect(splitMinimumShare({ minimumShare: 0, quantity: 0.66 }, 0.4)).toEqual({ doneShare: 0, replacementShare: 0 });
  });

  it("keeps the share in the two bills, so the farmer pays the same as without a breakdown", () => {
    const shares = splitMinimumShare(groupPlot, 0.04);
    const doneBill = billWorkDone(groupPlot, 0.04, noSubsidy, shares.doneShare);
    const replacementBill = billReplacement(groupPlot, 0.06, noSubsidy, shares.replacementShare);
    expect(doneBill.workCharge).toBe(100); // 60 Tk of work + 40 Tk of the share
    expect(replacementBill.workCharge).toBe(150); // 90 Tk of work + 60 Tk of the share
    // Booked: work 150 + share 100 + delivery 50 = 300 Tk.
    expect(doneBill.totalAmount + replacementBill.totalAmount).toBe(300);
  });
});

describe("sortReplacementMachines", () => {
  it("puts the nearest first, and the more trusted provider first at the same distance", () => {
    const machines = [
      { id: "far", distanceKm: 12, trustScore: 95 },
      { id: "near-low", distanceKm: 4, trustScore: 70 },
      { id: "near-high", distanceKm: 4, trustScore: 90 },
    ];
    expect(sortReplacementMachines(machines).map((machine) => machine.id)).toEqual(["near-high", "near-low", "far"]);
    expect(machines[0].id).toBe("far"); // the old list is not changed
  });
});
