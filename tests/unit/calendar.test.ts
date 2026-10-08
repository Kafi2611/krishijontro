// Unit tests for the date helpers and month grid in src/lib/services/calendar.ts.
import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  blockRangeFromDays,
  buildMonthGrid,
  countDays,
  monthGridRange,
  rangesOverlap,
  startOfDhakaDay,
  toDhakaDay,
} from "@/lib/services/calendar";

describe("Bangladesh days", () => {
  it("starts a Bangladesh day at 18:00 UTC of the day before", () => {
    expect(startOfDhakaDay("2026-10-08").toISOString()).toBe("2026-10-07T18:00:00.000Z");
  });

  it("finds the Bangladesh day of a moment", () => {
    // 19:00 UTC is already 1 AM the next day in Dhaka
    expect(toDhakaDay(new Date("2026-10-07T19:00:00Z"))).toBe("2026-10-08");
    expect(toDhakaDay(new Date("2026-10-07T17:59:00Z"))).toBe("2026-10-07");
  });

  it("adds days and months across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("counts days with both ends included", () => {
    expect(countDays("2026-10-08", "2026-10-08")).toBe(1);
    expect(countDays("2026-10-08", "2026-10-10")).toBe(3);
  });
});

describe("rangesOverlap", () => {
  const at = (time: string) => new Date(`2026-10-08T${time}:00+06:00`);

  it("finds overlapping ranges", () => {
    expect(rangesOverlap(at("08:00"), at("12:00"), at("11:00"), at("15:00"))).toBe(true);
    expect(rangesOverlap(at("08:00"), at("18:00"), at("10:00"), at("11:00"))).toBe(true); // one inside the other
  });

  it("lets one range start exactly when the other ends", () => {
    expect(rangesOverlap(at("08:00"), at("12:00"), at("12:00"), at("15:00"))).toBe(false);
  });

  it("finds no overlap for separate ranges", () => {
    expect(rangesOverlap(at("08:00"), at("10:00"), at("13:00"), at("15:00"))).toBe(false);
  });
});

describe("blockRangeFromDays", () => {
  it("covers the whole of both days", () => {
    const range = blockRangeFromDays("2026-10-10", "2026-10-11");
    expect(range.startAt.toISOString()).toBe("2026-10-09T18:00:00.000Z"); // 10 Oct 00:00 Dhaka
    expect(range.endAt.toISOString()).toBe("2026-10-11T18:00:00.000Z"); // 12 Oct 00:00 Dhaka
  });
});

describe("monthGridRange", () => {
  it("starts on a Sunday and ends on a Saturday", () => {
    // 1 Oct 2026 is a Thursday, 31 Oct 2026 is a Saturday
    expect(monthGridRange("2026-10")).toEqual({ firstDay: "2026-09-27", lastDay: "2026-10-31" });
  });
});

describe("buildMonthGrid", () => {
  const today = "2026-10-08";
  const busy = {
    // A booking on 12 Oct, 9 AM to 1 PM
    booked: [{ startAt: new Date("2026-10-12T09:00:00+06:00"), endAt: new Date("2026-10-12T13:00:00+06:00") }],
    // The provider blocked 20 and 21 Oct
    blocked: [blockRangeFromDays("2026-10-20", "2026-10-21")],
  };
  const days = buildMonthGrid("2026-10", today, busy).flat();
  const find = (day: string) => days.find((item) => item.day === day)!;

  it("has full weeks of 7 days", () => {
    const weeks = buildMonthGrid("2026-10", today, busy);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("marks each day correctly", () => {
    expect(find("2026-10-07").state).toBe("past");
    expect(find("2026-10-08")).toMatchObject({ isToday: true, state: "free" });
    expect(find("2026-10-12").state).toBe("booked");
    expect(find("2026-10-20").state).toBe("blocked");
    expect(find("2026-10-21").state).toBe("blocked");
    expect(find("2026-10-22").state).toBe("free"); // the block ends at 22 Oct 00:00
  });

  it("marks the days of the previous month as outside the month", () => {
    expect(find("2026-09-27").inMonth).toBe(false);
    expect(find("2026-10-01").inMonth).toBe(true);
  });
});
