// Unit tests for src/lib/services/login-state.ts: what an old login is worth, and where
// a visitor who may not go on is sent. Only a really suspended account may see the
// "suspended" message; a login whose account is gone is treated as logged out.
import { describe, expect, it } from "vitest";
import { CLEAR_LOGIN_PATH, getLoginPagePath, getLoginState } from "@/lib/services/login-state";

describe("getLoginState", () => {
  it("lets an active account go on", () => {
    expect(getLoginState({ status: "ACTIVE" })).toBe("ACTIVE");
  });

  it("stops a suspended account", () => {
    expect(getLoginState({ status: "SUSPENDED" })).toBe("SUSPENDED");
  });

  it("says ACCOUNT_GONE (not SUSPENDED) when the account no longer exists, e.g. after a new seed", () => {
    expect(getLoginState(null)).toBe("ACCOUNT_GONE");
  });
});

describe("getLoginPagePath", () => {
  it("sends a visitor who is not logged in to the normal login page", () => {
    expect(getLoginPagePath(null)).toBe("/login");
  });

  it("shows the suspended message only to a suspended account", () => {
    expect(getLoginPagePath("SUSPENDED")).toBe("/login?suspended=1");
  });

  it("sends a login whose account is gone to the route that clears it, without the suspended message", () => {
    expect(getLoginPagePath("ACCOUNT_GONE")).toBe(CLEAR_LOGIN_PATH);
    expect(CLEAR_LOGIN_PATH).toBe("/login/clear");
    expect(getLoginPagePath("ACCOUNT_GONE")).not.toContain("suspended");
  });

  it("works from the state of a missing account straight to the clear route", () => {
    expect(getLoginPagePath(getLoginState(null))).toBe("/login/clear");
  });
});
