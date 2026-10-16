// Unit tests for src/lib/services/booking-rules.ts: the allowed status moves, the job
// time, the booking code and OTP, what each person sees next, the list groups and the timeline.
import { describe, expect, it } from "vitest";
import type { BookingStatus } from "@/generated/prisma/enums";
import {
  ALLOWED_TRANSITIONS,
  buildTimeline,
  canChangeStatus,
  estimateWorkHours,
  formatBookingCode,
  generateOtp,
  getBookingYear,
  getJobStartAt,
  getJobTimeRange,
  getOperatorNextStep,
  getOtpToShow,
  groupOperatorJobs,
  groupProviderBookings,
  isStartFarEnough,
  readBookingSerial,
  splitFarmerBookings,
  type TimelineLog,
} from "@/lib/services/booking-rules";

describe("canChangeStatus", () => {
  it("allows the normal path of a booking", () => {
    expect(canChangeStatus("REQUESTED", "ACCEPTED")).toBe(true);
    expect(canChangeStatus("ACCEPTED", "OPERATOR_ASSIGNED")).toBe(true);
    expect(canChangeStatus("OPERATOR_ASSIGNED", "ON_THE_WAY")).toBe(true);
    expect(canChangeStatus("ON_THE_WAY", "WORKING")).toBe(true);
    expect(canChangeStatus("WORKING", "COMPLETED")).toBe(true);
    expect(canChangeStatus("COMPLETED", "PAID")).toBe(true);
    expect(canChangeStatus("PAID", "REVIEWED")).toBe(true);
  });

  it("allows rejecting a request and cancelling before the operator leaves", () => {
    expect(canChangeStatus("REQUESTED", "REJECTED")).toBe(true);
    expect(canChangeStatus("REQUESTED", "CANCELLED")).toBe(true);
    expect(canChangeStatus("OPERATOR_ASSIGNED", "CANCELLED")).toBe(true);
  });

  it("refuses skipping steps or going back", () => {
    expect(canChangeStatus("REQUESTED", "WORKING")).toBe(false);
    expect(canChangeStatus("ACCEPTED", "ON_THE_WAY")).toBe(false); // an operator must be assigned first
    expect(canChangeStatus("WORKING", "ACCEPTED")).toBe(false);
    expect(canChangeStatus("ON_THE_WAY", "CANCELLED")).toBe(false); // too late to cancel
  });

  it("lets nothing follow a rejected, cancelled or reviewed booking", () => {
    const endStatuses: BookingStatus[] = ["REJECTED", "CANCELLED", "REVIEWED"];
    for (const status of endStatuses) {
      expect(ALLOWED_TRANSITIONS[status]).toEqual([]);
    }
  });
});

describe("job time", () => {
  it("estimates how long the machine is busy", () => {
    expect(estimateWorkHours("PER_HOUR", 6)).toBe(6);
    expect(estimateWorkHours("PER_DAY", 2)).toBe(48);
    expect(estimateWorkHours("PER_ACRE", 0.66)).toBe(2); // 1.32 hours, rounded up
    expect(estimateWorkHours("PER_ACRE", 1.5)).toBe(3);
    expect(estimateWorkHours("PER_ACRE", 0.1)).toBe(1); // at least 1 hour
  });

  it("starts the job at the chosen hour in Bangladesh time", () => {
    // 8 AM in Dhaka is 2 AM UTC
    expect(getJobStartAt("2026-10-20", 8).toISOString()).toBe("2026-10-20T02:00:00.000Z");
  });

  it("ends the job after the estimated hours", () => {
    const range = getJobTimeRange("2026-10-20", 8, "PER_ACRE", 0.66);
    expect(range.startAt.toISOString()).toBe("2026-10-20T02:00:00.000Z");
    expect(range.endAt.toISOString()).toBe("2026-10-20T04:00:00.000Z"); // 10 AM in Dhaka
  });

  it("needs the start to be at least 2 hours away", () => {
    const now = new Date("2026-10-20T02:00:00.000Z");
    expect(isStartFarEnough(new Date("2026-10-20T04:00:00.000Z"), now)).toBe(true);
    expect(isStartFarEnough(new Date("2026-10-20T03:59:00.000Z"), now)).toBe(false);
    expect(isStartFarEnough(new Date("2026-10-19T04:00:00.000Z"), now)).toBe(false); // in the past
  });
});

describe("codes", () => {
  it("writes and reads booking codes", () => {
    expect(formatBookingCode(2026, 123)).toBe("KJ-2026-000123");
    expect(readBookingSerial("KJ-2026-000123")).toBe(123);
    expect(readBookingSerial("something else")).toBe(0);
  });

  it("uses the Bangladesh year (it is already 2027 in Dhaka at 19:00 UTC on 31 December)", () => {
    expect(getBookingYear(new Date("2026-12-31T19:00:00Z"))).toBe(2027);
  });

  it("makes 4-digit OTP codes", () => {
    for (let index = 0; index < 50; index++) {
      expect(generateOtp()).toMatch(/^\d{4}$/);
    }
  });
});

describe("what each person sees next", () => {
  it("shows the farmer the start code until work starts, then the finish code", () => {
    expect(getOtpToShow("REQUESTED")).toBe(null);
    expect(getOtpToShow("ACCEPTED")).toBe("start");
    expect(getOtpToShow("ON_THE_WAY")).toBe("start");
    expect(getOtpToShow("WORKING")).toBe("finish");
    expect(getOtpToShow("COMPLETED")).toBe(null);
  });

  it("gives the operator one button after the other", () => {
    expect(getOperatorNextStep("OPERATOR_ASSIGNED", false)).toBe("startTrip");
    expect(getOperatorNextStep("ON_THE_WAY", false)).toBe("arrive");
    expect(getOperatorNextStep("ON_THE_WAY", true)).toBe("startWork");
    expect(getOperatorNextStep("WORKING", true)).toBe("finishWork");
    expect(getOperatorNextStep("COMPLETED", true)).toBe(null);
  });
});

describe("groups for the lists", () => {
  const at = (iso: string) => new Date(iso);

  it("splits a farmer's bookings into current (soonest first) and earlier (newest first)", () => {
    const bookings = [
      { id: "paid-old", status: "PAID" as const, startAt: at("2026-09-01T03:00:00Z") },
      { id: "later", status: "ACCEPTED" as const, startAt: at("2026-10-25T03:00:00Z") },
      { id: "rejected", status: "REJECTED" as const, startAt: at("2026-10-01T03:00:00Z") },
      { id: "sooner", status: "REQUESTED" as const, startAt: at("2026-10-21T03:00:00Z") },
    ];
    const { current, earlier } = splitFarmerBookings(bookings);
    expect(current.map((booking) => booking.id)).toEqual(["sooner", "later"]);
    expect(earlier.map((booking) => booking.id)).toEqual(["rejected", "paid-old"]);
  });

  it("groups a provider's bookings by what to do next", () => {
    const bookings = [
      { id: "request", status: "REQUESTED" as const, startAt: at("2026-10-22T03:00:00Z") },
      { id: "accepted", status: "ACCEPTED" as const, startAt: at("2026-10-23T03:00:00Z") },
      { id: "working", status: "WORKING" as const, startAt: at("2026-10-20T03:00:00Z") },
      { id: "done", status: "COMPLETED" as const, startAt: at("2026-10-10T03:00:00Z") },
    ];
    const groups = groupProviderBookings(bookings);
    expect(groups.requests.map((booking) => booking.id)).toEqual(["request"]);
    expect(groups.needOperator.map((booking) => booking.id)).toEqual(["accepted"]);
    expect(groups.ongoing.map((booking) => booking.id)).toEqual(["working"]);
    expect(groups.earlier.map((booking) => booking.id)).toEqual(["done"]);
  });

  it("puts an operator's jobs of today (and late ones) under 'now'", () => {
    const today = "2026-10-20";
    const jobs = [
      { id: "late", status: "OPERATOR_ASSIGNED" as const, startAt: at("2026-10-19T03:00:00Z") },
      { id: "today", status: "ON_THE_WAY" as const, startAt: at("2026-10-20T03:00:00Z") },
      { id: "tomorrow", status: "OPERATOR_ASSIGNED" as const, startAt: at("2026-10-21T03:00:00Z") },
      { id: "finished", status: "COMPLETED" as const, startAt: at("2026-10-18T03:00:00Z") },
    ];
    const groups = groupOperatorJobs(jobs, today);
    expect(groups.now.map((job) => job.id)).toEqual(["late", "today"]);
    expect(groups.coming.map((job) => job.id)).toEqual(["tomorrow"]);
    expect(groups.done.map((job) => job.id)).toEqual(["finished"]);
  });
});

describe("buildTimeline", () => {
  const log = (toStatus: BookingStatus, iso: string): TimelineLog => ({
    toStatus,
    createdAt: new Date(iso),
    actorName: "Someone",
    note: null,
  });

  it("shows what happened, then the steps still to come", () => {
    const steps = buildTimeline([log("REQUESTED", "2026-10-18T03:00:00Z"), log("ACCEPTED", "2026-10-18T04:00:00Z")], null, "ACCEPTED");
    expect(steps.filter((step) => step.done).map((step) => step.key)).toEqual(["REQUESTED", "ACCEPTED"]);
    expect(steps.filter((step) => !step.done).map((step) => step.key)).toEqual([
      "OPERATOR_ASSIGNED",
      "ON_THE_WAY",
      "ARRIVED",
      "WORKING",
      "COMPLETED",
      "PAID",
      "REVIEWED",
    ]);
  });

  it("puts 'Arrived' right after 'On the way' once the operator has arrived", () => {
    const logs = [
      log("REQUESTED", "2026-10-18T03:00:00Z"),
      log("ACCEPTED", "2026-10-18T04:00:00Z"),
      log("OPERATOR_ASSIGNED", "2026-10-18T05:00:00Z"),
      log("ON_THE_WAY", "2026-10-20T02:00:00Z"),
    ];
    const steps = buildTimeline(logs, new Date("2026-10-20T02:40:00Z"), "ON_THE_WAY");
    const keys = steps.map((step) => step.key);
    expect(keys.slice(3, 6)).toEqual(["ON_THE_WAY", "ARRIVED", "WORKING"]);
    expect(steps[4].done).toBe(true);
    expect(steps[5].done).toBe(false);
  });

  it("stops at a rejected booking with the reason and no steps to come", () => {
    const rejected = { ...log("REJECTED", "2026-10-18T04:00:00Z"), note: "Machine is busy that week" };
    const steps = buildTimeline([log("REQUESTED", "2026-10-18T03:00:00Z"), rejected], null, "REJECTED");
    expect(steps.map((step) => step.key)).toEqual(["REQUESTED", "REJECTED"]);
    expect(steps[1].note).toBe("Machine is busy that week");
  });
});
