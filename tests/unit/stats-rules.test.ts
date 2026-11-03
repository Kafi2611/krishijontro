// Unit tests for src/lib/services/stats-rules.ts: the chart helpers of the dashboards and reports.
import { describe, expect, it } from "vitest";
import { heatLevel, heatLevelRanges, lastMonths, niceTicks, sumByKey, sumByMonth } from "@/lib/services/stats-rules";

describe("lastMonths", () => {
  it("ends with this month in Bangladesh, oldest first", () => {
    expect(lastMonths(3, new Date("2026-11-03T10:00:00Z"))).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("goes back over a new year, and uses Dhaka time (UTC+6)", () => {
    // 31 Dec 2026 at 7 PM UTC is already 1 Jan 2027 in Dhaka.
    expect(lastMonths(2, new Date("2026-12-31T19:00:00Z"))).toEqual(["2026-12", "2027-01"]);
  });
});

describe("sumByMonth", () => {
  const months = ["2026-10", "2026-11"];

  it("adds amounts into their month and fills empty months with 0", () => {
    const rows = [
      { date: new Date("2026-10-05T06:00:00Z"), amount: 100 },
      { date: new Date("2026-10-07T06:00:00Z"), amount: 50 },
    ];
    expect(sumByMonth(rows, months)).toEqual([
      { key: "2026-10", value: 150 },
      { key: "2026-11", value: 0 },
    ]);
  });

  it("ignores rows outside the months", () => {
    expect(sumByMonth([{ date: new Date("2026-08-01T06:00:00Z"), amount: 9 }], months)[0].value).toBe(0);
  });
});

describe("sumByKey", () => {
  it("adds by name, biggest first, then A to Z", () => {
    const rows = [
      { key: "Rajshahi", amount: 1 },
      { key: "Dhaka", amount: 1 },
      { key: "Rajshahi", amount: 1 },
      { key: "Bogura", amount: 1 },
    ];
    expect(sumByKey(rows)).toEqual([
      { key: "Rajshahi", value: 2 },
      { key: "Bogura", value: 1 },
      { key: "Dhaka", value: 1 },
    ]);
  });

  it("keeps at most `limit` names", () => {
    const rows = ["a", "b", "c"].map((key) => ({ key, amount: 1 }));
    expect(sumByKey(rows, 2)).toHaveLength(2);
  });
});

describe("heatLevel", () => {
  it("cuts 1..max into 5 equal steps", () => {
    expect([1, 2, 3, 5, 8, 10].map((value) => heatLevel(value, 10))).toEqual([0, 0, 1, 2, 3, 4]);
  });

  it("never goes outside 0..4", () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(12, 10)).toBe(4);
    expect(heatLevel(3, 0)).toBe(0);
  });

  it("gives the legend's ranges", () => {
    expect(heatLevelRanges(10)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]);
    expect(heatLevelRanges(3)).toEqual([null, [1, 1], null, [2, 2], [3, 3]]);
    // Every value gets the step whose legend range holds it.
    for (const max of [3, 7, 10, 23]) {
      const ranges = heatLevelRanges(max);
      for (let value = 1; value <= max; value++) {
        const range = ranges[heatLevel(value, max)];
        expect(range && value >= range[0] && value <= range[1]).toBe(true);
      }
    }
  });
});

describe("niceTicks", () => {
  it("picks 4 clean, whole steps that reach the biggest value", () => {
    expect(niceTicks(370)).toEqual([0, 100, 200, 300, 400]);
    expect(niceTicks(18)).toEqual([0, 5, 10, 15, 20]);
    expect(niceTicks(12)).toEqual([0, 3, 6, 9, 12]);
    expect(niceTicks(4500)).toEqual([0, 1500, 3000, 4500, 6000]);
    expect(niceTicks(2)).toEqual([0, 1, 2, 3, 4]);
  });

  it("still draws an axis when everything is 0", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});
