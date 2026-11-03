// Zod rules for the admin's Settings form (platform fee, cancellation rules, breakdowns).
// The same rules run in the browser (the form) and on the server (the server action).
// Every setting is a whole number inside its limits (SETTING_LIMITS in settings-rules.ts).
import { z } from "zod";
import { SETTING_LIMITS, type PlatformSettingKey } from "@/lib/services/settings-rules";

/** The rule for one setting: a whole number from its min to its max. */
function settingField(key: PlatformSettingKey) {
  const { min, max } = SETTING_LIMITS[key];
  return z.number("numberInvalid").int("settingOutOfRange").min(min, "settingOutOfRange").max(max, "settingOutOfRange");
}

export const settingsSchema = z.object({
  platformFeePercent: settingField("platformFeePercent"),
  freeCancellationHours: settingField("freeCancellationHours"),
  cancellationFeePercent: settingField("cancellationFeePercent"),
  replacementRadiusKm: settingField("replacementRadiusKm"),
  replacementTimeoutHours: settingField("replacementTimeoutHours"),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
