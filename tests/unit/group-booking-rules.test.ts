// Unit tests for src/lib/services/group-booking-rules.ts: sharing the delivery charge,
// the back-to-back schedule, the price of a group booking and how far a group is.
import { describe, expect, it } from "vitest";
import { countGroupProgress, priceGroupBooking, scheduleBackToBack, splitEqually } from "@/lib/services/group-booking-rules";

describe("splitEqually", () => {
  it("shares whole taka, the first parts get 1 Tk more", () => {
    expect(splitEqually(250, 3)).toEqual([84, 83, 83]);
    expect(splitEqually(300, 3)).toEqual([100, 100, 100]);
    expect(splitEqually(5, 2)).toEqual([3, 2]);
  });

  it("always adds up to the total, also for 0", () => {
    for (const [total, count] of [[251, 4], [1, 5], [0, 3], [999, 7]]) {
      const parts = splitEqually(total, count);
      expect(parts).toHaveLength(count);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
    }
  });
});

describe("scheduleBackToBack", () => {
  const start = new Date("2026-11-10T02:00:00Z"); // 8:00 AM in Dhaka

  it("starts each plot when the one before ends", () => {
    const ranges = scheduleBackToBack(start, [2, 3, 1]);
    expect(ranges.map((range) => range.startAt.toISOString())).toEqual([
      "2026-11-10T02:00:00.000Z",
      "2026-11-10T04:00:00.000Z",
      "2026-11-10T07:00:00.000Z",
    ]);
    expect(ranges[2].endAt.toISOString()).toBe("2026-11-10T08:00:00.000Z"); // 2:00 PM
  });
});

describe("priceGroupBooking", () => {
  // The project's price example, three times: 66 decimal at 2400 Tk/acre, 8 km away.
  const input = {
    rate: 2400,
    minCharge: 0.5,
    distanceKm: 8,
    freeKm: 3,
    deliveryRatePerKm: 50,
    platformFeePercent: 3,
    plots: [
      { quantity: 0.66, subsidyPercent: 20 },
      { quantity: 0.66, subsidyPercent: 0 },
      { quantity: 0.2, subsidyPercent: 0 },
    ],
  };

  it("charges ONE trip and shares it equally", () => {
    const price = priceGroupBooking(input);
    expect(price.totalDeliveryCharge).toBe(250);
    expect(price.bills.map((bill) => bill.deliveryCharge)).toEqual([84, 83, 83]);
  });

  it("gives each plot its own work charge and its own farmer's subsidy", () => {
    const [first, second, third] = priceGroupBooking(input).bills;
    expect(first.workCharge).toBe(1584);
    expect(first.subsidyAmount).toBe(317);
    expect(first.totalAmount).toBe(1351); // 1584 + 84 − 317
    expect(second.totalAmount).toBe(1667); // 1584 + 83, no subsidy
    expect(third.billedQuantity).toBe(0.5); // a tiny plot is billed as the minimum
    expect(third.workCharge).toBe(1200);
  });

  it("charges no delivery when the village is within the free km", () => {
    const price = priceGroupBooking({ ...input, distanceKm: 2 });
    expect(price.totalDeliveryCharge).toBe(0);
    expect(price.bills.every((bill) => bill.deliveryCharge === 0)).toBe(true);
  });
});

describe("countGroupProgress", () => {
  it("counts the plots by stage and leaves stopped plots out of the total", () => {
    const progress = countGroupProgress([
      { status: "REQUESTED", totalAmount: 1351 },
      { status: "ACCEPTED", totalAmount: 1667 },
      { status: "PAID", totalAmount: 1283 },
      { status: "CANCELLED", totalAmount: 1000 },
    ]);
    expect(progress).toEqual({ plots: 4, waiting: 1, going: 1, done: 1, stopped: 1, total: 4301 });
  });
});
