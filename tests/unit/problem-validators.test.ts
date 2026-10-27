// Unit tests for the Phase 6 form rules: the operator's breakdown report
// (validators/breakdown.ts), the repair and service forms (validators/maintenance.ts), the
// farmer's review (validators/review.ts) and joining the waitlist (validators/waitlist.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { breakdownSchema, type BreakdownInput } from "@/lib/validators/breakdown";
import { providerCancelSchema } from "@/lib/validators/booking";
import { finishRepairSchema, maintenanceRequestSchema } from "@/lib/validators/maintenance";
import { reviewSchema, type ReviewInput } from "@/lib/validators/review";
import { joinWaitlistSchema, type JoinWaitlistInput } from "@/lib/validators/waitlist";

/** The error keys Zod gives (empty list = the values are fine). */
function errorKeys(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.message);
}

describe("breakdownSchema", () => {
  const report: BreakdownInput = {
    doneAmount: 40,
    description: "Gear box makes a noise",
    photoUrls: ["/uploads/9f86d081884c7d659a2feaa0c55ad015.jpg"],
  };

  it("accepts the work done, what is wrong and one photo", () => {
    expect(errorKeys(breakdownSchema.safeParse(report))).toEqual([]);
    expect(errorKeys(breakdownSchema.safeParse({ ...report, doneAmount: 0, photoUrls: [] }))).toEqual([]);
  });

  it("asks what is wrong (at least 5 letters)", () => {
    expect(errorKeys(breakdownSchema.safeParse({ ...report, description: "bad" }))).toEqual(["describeProblem"]);
  });

  it("refuses work below 0, a strange photo address and more than one photo", () => {
    expect(errorKeys(breakdownSchema.safeParse({ ...report, doneAmount: -1 }))).toEqual(["numberInvalid"]);
    expect(errorKeys(breakdownSchema.safeParse({ ...report, photoUrls: ["https://example.com/a.jpg"] }))).toEqual(["uploadFailed"]);
    expect(errorKeys(breakdownSchema.safeParse({ ...report, photoUrls: [...report.photoUrls, ...report.photoUrls] }))).toEqual([
      "tooManyPhotos",
    ]);
  });
});

describe("maintenance forms", () => {
  it("lets the provider ask for a service or a repair with a short description", () => {
    expect(errorKeys(maintenanceRequestSchema.safeParse({ type: "SERVICE", description: "250 hour service" }))).toEqual([]);
    expect(errorKeys(maintenanceRequestSchema.safeParse({ type: "REPAIR", description: "oil" }))).toEqual(["describeProblem"]);
  });

  it("takes the parts and whole-taka costs when the technician marks it fixed", () => {
    const fixed = { partsUsed: "Fuel filter x1", partsCost: 450, labourCost: 300, technicianNote: "" };
    expect(errorKeys(finishRepairSchema.safeParse(fixed))).toEqual([]);
    expect(errorKeys(finishRepairSchema.safeParse({ ...fixed, partsUsed: "", partsCost: 0 }))).toEqual([]); // no parts needed
    expect(errorKeys(finishRepairSchema.safeParse({ ...fixed, labourCost: 300.5 }))).toEqual(["wholeTaka"]);
    expect(errorKeys(finishRepairSchema.safeParse({ ...fixed, partsCost: -10 }))).toEqual(["numberInvalid"]);
  });
});

describe("reviewSchema", () => {
  const review: ReviewInput = { machineRating: 5, machineComment: "Very good", operatorRating: 4, operatorComment: "" };

  it("takes 1 to 5 stars for the machine and for the operator", () => {
    expect(errorKeys(reviewSchema.safeParse(review))).toEqual([]);
    expect(errorKeys(reviewSchema.safeParse({ ...review, operatorRating: 1 }))).toEqual([]);
  });

  it("asks for the stars when none were chosen, or the number is wrong", () => {
    expect(errorKeys(reviewSchema.safeParse({ ...review, machineRating: 0 }))).toEqual(["ratingRequired"]);
    expect(errorKeys(reviewSchema.safeParse({ ...review, operatorRating: 6 }))).toEqual(["ratingRequired"]);
    expect(errorKeys(reviewSchema.safeParse({ ...review, machineRating: 3.5 }))).toEqual(["ratingRequired"]);
  });
});

describe("providerCancelSchema", () => {
  it("needs a reason, like a rejection", () => {
    expect(errorKeys(providerCancelSchema.safeParse({ reason: "Machine needs a repair" }))).toEqual([]);
    expect(errorKeys(providerCancelSchema.safeParse({ reason: "no" }))).toEqual(["reasonRequired"]);
  });
});

describe("joinWaitlistSchema", () => {
  // The day rules compare with "today", so the clock is frozen at 20 October 2026 in Dhaka.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const entry: JoinWaitlistInput = {
    machineTypeId: "type-1",
    workType: "HARVESTING",
    landValue: 2,
    landUnit: "BIGHA",
    lat: 24.47,
    lng: 88.77,
    day: "2026-10-25",
  };

  it("takes the searched work, land, field and day, and the kind of machine", () => {
    expect(errorKeys(joinWaitlistSchema.safeParse(entry))).toEqual([]);
  });

  it("refuses a day in the past, or more than 60 days ahead", () => {
    expect(errorKeys(joinWaitlistSchema.safeParse({ ...entry, day: "2026-10-19" }))).toEqual(["dayInPast"]);
    expect(errorKeys(joinWaitlistSchema.safeParse({ ...entry, day: "2027-01-30" }))).toEqual(["dayTooFar"]);
  });

  it("needs the kind of machine, and a field inside Bangladesh", () => {
    expect(errorKeys(joinWaitlistSchema.safeParse({ ...entry, machineTypeId: "" }))).toEqual(["required"]);
    expect(errorKeys(joinWaitlistSchema.safeParse({ ...entry, lat: 30 }))).toEqual(["outsideBangladesh"]);
  });
});
