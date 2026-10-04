// Unit tests for src/lib/roles.ts (which URL belongs to which role).
import { describe, expect, it } from "vitest";
import {
  getHomePathForRole,
  getRoleForPath,
  isAccountPath,
  splitLocaleFromPath,
} from "@/lib/roles";

describe("getRoleForPath", () => {
  it("finds the role from the first folder of the path", () => {
    expect(getRoleForPath("/farmer")).toBe("FARMER");
    expect(getRoleForPath("/farmer/bookings/abc")).toBe("FARMER");
    expect(getRoleForPath("/cooperative")).toBe("COOP_LEADER");
    expect(getRoleForPath("/admin/users")).toBe("ADMIN");
  });

  it("returns null for public pages", () => {
    expect(getRoleForPath("/")).toBeNull();
    expect(getRoleForPath("/login")).toBeNull();
  });

  it("matches whole folder names only", () => {
    // "/farmers" is NOT the farmer area
    expect(getRoleForPath("/farmers")).toBeNull();
  });
});

describe("getHomePathForRole", () => {
  it("gives each role its own dashboard", () => {
    expect(getHomePathForRole("PROVIDER")).toBe("/provider");
    expect(getHomePathForRole("GOVT")).toBe("/govt");
  });
});

describe("isAccountPath", () => {
  it("knows the pages every logged-in user has", () => {
    expect(isAccountPath("/profile")).toBe(true);
    expect(isAccountPath("/notifications")).toBe(true);
    expect(isAccountPath("/profiles")).toBe(false);
    expect(isAccountPath("/farmer")).toBe(false);
  });
});

describe("splitLocaleFromPath", () => {
  it("separates the language from the rest of the path", () => {
    expect(splitLocaleFromPath("/bn/farmer/bookings")).toEqual({
      locale: "bn",
      path: "/farmer/bookings",
    });
    expect(splitLocaleFromPath("/en")).toEqual({ locale: "en", path: "/" });
  });

  it("uses English when the path has no language", () => {
    expect(splitLocaleFromPath("/farmer")).toEqual({ locale: "en", path: "/farmer" });
    expect(splitLocaleFromPath("/english")).toEqual({ locale: "en", path: "/english" });
  });
});
