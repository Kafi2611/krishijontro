/**
 * Settings rules — the platform settings the admin can change on the Settings page.
 *
 * Everything here is plain data or a pure function (no database), so it is easy to test and
 * the settings form in the browser can use the same list.
 *   - PLATFORM_SETTING_KEYS: the five settings, in the order the page shows them
 *   - DEFAULT_PLATFORM_SETTINGS: the value used when a setting is missing from the database
 *   - SETTING_LIMITS: the smallest and biggest value the admin may save
 *   - listSettingChanges(): what changed, as short text for the audit log
 */
import {
  DEFAULT_CANCELLATION_FEE_PERCENT,
  DEFAULT_FREE_CANCELLATION_HOURS,
} from "@/lib/services/cancellation-rules";

/** The settings the admin can change. Each one is a row in the Setting table (key -> value). */
export const PLATFORM_SETTING_KEYS = [
  "platformFeePercent",
  "freeCancellationHours",
  "cancellationFeePercent",
  "replacementRadiusKm",
  "replacementTimeoutHours",
] as const;

export type PlatformSettingKey = (typeof PLATFORM_SETTING_KEYS)[number];

/** All five settings as numbers, e.g. { platformFeePercent: 3, freeCancellationHours: 24, ... }. */
export type PlatformSettings = Record<PlatformSettingKey, number>;

/** Platform fee used when the setting is missing: 3% of work + delivery. */
export const DEFAULT_PLATFORM_FEE_PERCENT = 3;

/** Replacement machines are searched this many km around the field, when the setting is missing. */
export const DEFAULT_REPLACEMENT_RADIUS_KM = 15;

/** The admin may give up the replacement search this many hours after a breakdown, when the setting is missing. */
export const DEFAULT_REPLACEMENT_TIMEOUT_HOURS = 2;

/** The value of each setting when it is missing from the database. */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
  freeCancellationHours: DEFAULT_FREE_CANCELLATION_HOURS,
  cancellationFeePercent: DEFAULT_CANCELLATION_FEE_PERCENT,
  replacementRadiusKm: DEFAULT_REPLACEMENT_RADIUS_KM,
  replacementTimeoutHours: DEFAULT_REPLACEMENT_TIMEOUT_HOURS,
};

/**
 * The smallest and biggest value of each setting (whole numbers only).
 * They stop a typing mistake from breaking the app, e.g. a 300% platform fee.
 */
export const SETTING_LIMITS: Record<PlatformSettingKey, { min: number; max: number }> = {
  platformFeePercent: { min: 0, max: 20 },
  freeCancellationHours: { min: 0, max: 168 }, // 168 hours = one week
  cancellationFeePercent: { min: 0, max: 50 },
  replacementRadiusKm: { min: 1, max: 50 },
  replacementTimeoutHours: { min: 1, max: 24 },
};

/** A short English note saved next to each value in the Setting table (for anyone reading the database). */
export const SETTING_DESCRIPTIONS: Record<PlatformSettingKey, string> = {
  platformFeePercent: "Platform fee taken from each booking (%)",
  freeCancellationHours: "Farmer can cancel for free until this many hours before start",
  cancellationFeePercent: "Late cancellation fee (% of work charge)",
  replacementRadiusKm: "Search radius for an emergency replacement machine",
  replacementTimeoutHours: "Hours to wait for a replacement before refunding",
};

/**
 * The settings whose value changed, as short text for the audit log (in the page's order).
 * Example: platform fee 3 -> 4, everything else the same -> ["platformFeePercent: 3 -> 4"]
 */
export function listSettingChanges(before: PlatformSettings, after: PlatformSettings): string[] {
  const changes: string[] = [];
  for (const key of PLATFORM_SETTING_KEYS) {
    if (before[key] !== after[key]) {
      changes.push(`${key}: ${before[key]} -> ${after[key]}`);
    }
  }
  return changes;
}
