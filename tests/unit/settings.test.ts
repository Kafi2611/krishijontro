// Unit tests for the admin's Settings: the form rules (validators/settings.ts) and the
// audit log text of a change (listSettingChanges in services/settings-rules.ts).
import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_SETTINGS, listSettingChanges } from "@/lib/services/settings-rules";
import { settingsSchema } from "@/lib/validators/settings";

describe("settingsSchema", () => {
  it("accepts the default settings", () => {
    expect(settingsSchema.safeParse(DEFAULT_PLATFORM_SETTINGS).success).toBe(true);
  });

  it("accepts the edges of each range (0% fee, 0 free hours, 1 km)", () => {
    const edges = { ...DEFAULT_PLATFORM_SETTINGS, platformFeePercent: 0, freeCancellationHours: 0, replacementRadiusKm: 1 };
    expect(settingsSchema.safeParse(edges).success).toBe(true);
  });

  it("refuses values outside the range or with a fraction", () => {
    const tooBig = settingsSchema.safeParse({ ...DEFAULT_PLATFORM_SETTINGS, platformFeePercent: 30 });
    expect(tooBig.success).toBe(false);
    expect(tooBig.error?.issues[0].message).toBe("settingOutOfRange");
    expect(settingsSchema.safeParse({ ...DEFAULT_PLATFORM_SETTINGS, replacementRadiusKm: 0 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_PLATFORM_SETTINGS, cancellationFeePercent: 2.5 }).success).toBe(false);
  });

  it("refuses an empty box", () => {
    const empty = settingsSchema.safeParse({ ...DEFAULT_PLATFORM_SETTINGS, replacementTimeoutHours: undefined });
    expect(empty.error?.issues[0].message).toBe("numberInvalid");
  });
});

describe("listSettingChanges", () => {
  it("lists only the values that changed, old -> new", () => {
    const after = { ...DEFAULT_PLATFORM_SETTINGS, platformFeePercent: 4, freeCancellationHours: 12 };
    expect(listSettingChanges(DEFAULT_PLATFORM_SETTINGS, after)).toEqual([
      "platformFeePercent: 3 -> 4",
      "freeCancellationHours: 24 -> 12",
    ]);
  });

  it("is empty when nothing changed", () => {
    expect(listSettingChanges(DEFAULT_PLATFORM_SETTINGS, { ...DEFAULT_PLATFORM_SETTINGS })).toEqual([]);
  });
});
