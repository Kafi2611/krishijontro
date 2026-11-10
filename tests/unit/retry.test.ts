// Unit tests for src/lib/retry.ts: running a step again after an expected error.
import { describe, expect, it } from "vitest";
import { retryWhen } from "@/lib/retry";

/** A step that fails `failures` times with `error`, then returns "saved". Counts its tries. */
function flakyStep(failures: number, error: Error) {
  const step = async () => {
    step.tries += 1;
    if (step.tries <= failures) {
      throw error;
    }
    return "saved";
  };
  step.tries = 0;
  return step;
}

const codeTaken = new Error("code taken");
const isCodeTaken = (error: unknown) => error === codeTaken;

describe("retryWhen", () => {
  it("returns at once when the step works", async () => {
    const step = flakyStep(0, codeTaken);
    expect(await retryWhen(step, isCodeTaken, 3)).toBe("saved");
    expect(step.tries).toBe(1);
  });

  it("tries again after an expected error: two bookings at once get the 3rd try", async () => {
    const step = flakyStep(2, codeTaken);
    expect(await retryWhen(step, isCodeTaken, 3)).toBe("saved");
    expect(step.tries).toBe(3);
  });

  it("gives up after the last try and throws the error", async () => {
    const step = flakyStep(5, codeTaken);
    await expect(retryWhen(step, isCodeTaken, 3)).rejects.toBe(codeTaken);
    expect(step.tries).toBe(3);
  });

  it("never tries again after an unexpected error", async () => {
    const otherError = new Error("database is down");
    const step = flakyStep(1, otherError);
    await expect(retryWhen(step, isCodeTaken, 3)).rejects.toBe(otherError);
    expect(step.tries).toBe(1);
  });
});
