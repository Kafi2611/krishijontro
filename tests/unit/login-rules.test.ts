// Unit tests for src/lib/services/login-rules.ts: when wrong logins lock a mobile number or a
// connection, for how long, and how the connection's address is read.
import { describe, expect, it } from "vitest";
import { getLockEnd, isLocked, LOGIN_LIMITS, readClientIp } from "@/lib/services/login-rules";

/** A time on 20 October 2026, e.g. at(10, 3) = 10:03. */
function at(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 9, 20, hour, minute));
}

describe("the limits", () => {
  it("are 5 tries per number and 20 per connection, in 15 minutes, for 15 minutes", () => {
    expect(LOGIN_LIMITS).toEqual({ perPhone: 5, perConnection: 20, windowMinutes: 15, lockMinutes: 15 });
  });
});

describe("getLockEnd", () => {
  const fiveTries = [at(10, 0), at(10, 1), at(10, 2), at(10, 3), at(10, 4)];

  it("locks for 15 minutes after the 5th wrong try within 15 minutes", () => {
    expect(getLockEnd(fiveTries, 5)).toEqual(at(10, 19));
  });

  it("does not lock after only 4 wrong tries", () => {
    expect(getLockEnd(fiveTries.slice(0, 4), 5)).toBeNull();
  });

  it("does not lock when the 5 tries are spread over more than 15 minutes", () => {
    const spread = [at(10, 0), at(10, 5), at(10, 10), at(10, 15), at(10, 20)];
    expect(getLockEnd(spread, 5)).toBeNull();
  });

  it("does not care about the order of the tries", () => {
    expect(getLockEnd([...fiveTries].reverse(), 5)).toEqual(at(10, 19));
  });
});

describe("isLocked", () => {
  const fiveTries = [at(10, 0), at(10, 1), at(10, 2), at(10, 3), at(10, 4)];

  it("is locked during the 15 minutes, and open again after them", () => {
    expect(isLocked(fiveTries, 5, at(10, 10))).toBe(true);
    expect(isLocked(fiveTries, 5, at(10, 19))).toBe(false);
    expect(isLocked(fiveTries, 5, at(10, 30))).toBe(false);
  });

  it("needs 20 tries for a connection", () => {
    const twentyTries = Array.from({ length: 20 }, (_, index) => new Date(at(10, 0).getTime() + index * 30_000));
    expect(isLocked(twentyTries.slice(0, 19), 20, at(10, 12))).toBe(false);
    expect(isLocked(twentyTries, 20, at(10, 12))).toBe(true);
  });
});

describe("readClientIp", () => {
  it("takes the visitor's address: the first one in x-forwarded-for", () => {
    expect(readClientIp(new Headers({ "x-forwarded-for": "103.4.5.6, 10.0.0.1" }))).toBe("103.4.5.6");
    expect(readClientIp(new Headers({ "x-real-ip": "103.4.5.7" }))).toBe("103.4.5.7");
  });

  it("gives null when the address is not known", () => {
    expect(readClientIp(new Headers())).toBeNull();
    expect(readClientIp(new Headers({ "x-forwarded-for": " " }))).toBeNull();
  });
});
