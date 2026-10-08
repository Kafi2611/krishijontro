// Unit tests for src/lib/form-values.ts (reading numbers typed in form boxes).
import { describe, expect, it } from "vitest";
import { numberFromInput } from "@/lib/form-values";

describe("numberFromInput", () => {
  it("reads normal numbers, with spaces around them", () => {
    expect(numberFromInput("2400")).toBe(2400);
    expect(numberFromInput(" 12.5 ")).toBe(12.5);
  });

  it("reads numbers typed with Bangla digits", () => {
    expect(numberFromInput("২৪০০")).toBe(2400);
  });

  it("gives undefined for an empty box", () => {
    expect(numberFromInput("")).toBeUndefined();
    expect(numberFromInput("   ")).toBeUndefined();
    expect(numberFromInput(undefined)).toBeUndefined();
  });

  it("gives NaN for text that is not a number", () => {
    expect(numberFromInput("abc")).toBeNaN();
  });

  it("keeps a value that is already a number", () => {
    expect(numberFromInput(47)).toBe(47);
  });
});
