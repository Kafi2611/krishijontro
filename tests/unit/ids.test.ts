// Unit tests for src/lib/validators/ids.ts: the shape of the ids server actions accept.
import { describe, expect, it } from "vitest";
import { areIds, transactionIdSchema } from "@/lib/validators/ids";

describe("areIds", () => {
  it("accepts database ids made by Prisma", () => {
    expect(areIds("cmwahd7z30034solls1riliv1")).toBe(true);
    expect(areIds("cmwahd7z30034solls1riliv1", "cmwahd82x0036solld0vrj7fr")).toBe(true);
  });

  it("refuses anything else a changed page could send", () => {
    expect(areIds(42)).toBe(false);
    expect(areIds({ id: "abc" })).toBe(false);
    expect(areIds("")).toBe(false);
    expect(areIds("../../etc")).toBe(false);
    expect(areIds("a".repeat(41))).toBe(false);
    expect(areIds("cmwahd7z30034solls1riliv1", null)).toBe(false); // every value must be an id
  });
});

describe("transactionIdSchema", () => {
  it("accepts our payment ids and refuses others", () => {
    expect(transactionIdSchema.safeParse("PAY-KJ-2026-000023-7F3A9C").success).toBe(true);
    expect(transactionIdSchema.safeParse("cmwahd7z30034solls1riliv1").success).toBe(false);
    expect(transactionIdSchema.safeParse(123).success).toBe(false);
  });
});
