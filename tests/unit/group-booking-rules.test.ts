// Unit tests for src/lib/services/group-booking-rules.ts: sharing the delivery charge,
// the back-to-back schedule, the group's minimum charge, the price of a group booking and how far a group is.
import { describe, expect, it } from "vitest";
import {
  countGroupProgress,
  priceGroupBooking,
  scheduleBackToBack,
  shareGroupMinimum,
  splitEqually,
} from "@/lib/services/group-booking-rules";

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

describe("shareGroupMinimum", () => {
  it("charges nothing extra when all plots together reach the minimum", () => {
    // 30 + 40 decimal = 0.7 acre, the tractor's minimum is 0.5 acre.
    expect(shareGroupMinimum([0.3, 0.4], 2400, 0.5)).toEqual([0, 0]);
    // Exactly the minimum is enough.
    expect(shareGroupMinimum([0.2, 0.3], 2400, 0.5)).toEqual([0, 0]);
    // 0.1 + 0.2 + 0.2 gives 0.5000000000000001 in JavaScript; comparing rounded numbers still says "reached".
    expect(shareGroupMinimum([0.1, 0.2, 0.2], 2400, 0.5)).toEqual([0, 0, 0]);
  });

  it("shares the missing taka equally when the plots together are below the minimum", () => {
    // Minimum 0.5 × 2400 = 1200 Tk; own work 240 + 480 = 720 Tk; 480 Tk is missing.
    expect(shareGroupMinimum([0.1, 0.2], 2400, 0.5)).toEqual([240, 240]);
  });

  it("shares in whole taka that add up exactly (the first plots get 1 Tk more)", () => {
    // Minimum 0.5 × 1000 = 500 Tk; own work 100 × 3 = 300 Tk; 200 Tk missing -> 67 + 67 + 66.
    const shares = shareGroupMinimum([0.1, 0.1, 0.1], 1000, 0.5);
    expect(shares).toEqual([67, 67, 66]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(200);
  });

  it("works for machines rented per hour too (a pump with a 2 hour minimum)", () => {
    expect(shareGroupMinimum([1.5, 1], 200, 2)).toEqual([0, 0]); // 2.5 hours together
    expect(shareGroupMinimum([0.5, 1], 200, 2)).toEqual([50, 50]); // 1.5 hours: 100 Tk missing
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
    // 0.2 acre alone is below the 0.5 acre minimum, but the group has 1.52 acre: it pays only its own land.
    expect(third.billedQuantity).toBe(0.2);
    expect(third.minimumShare).toBe(0);
    expect(third.workCharge).toBe(480);
  });

  it("shares the missing part of the minimum when all plots together are too small", () => {
    const small = priceGroupBooking({
      ...input,
      plots: [
        { quantity: 0.1, subsidyPercent: 0 },
        { quantity: 0.2, subsidyPercent: 0 },
      ],
    });
    // The minimum costs 0.5 × 2400 = 1200; the plots' own work 240 + 480 = 720; 480 is shared.
    expect(small.bills.map((bill) => bill.minimumShare)).toEqual([240, 240]);
    expect(small.bills.map((bill) => bill.workCharge)).toEqual([480, 720]);
    expect(small.bills[0].workCharge + small.bills[1].workCharge).toBe(1200); // together: exactly the minimum
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
