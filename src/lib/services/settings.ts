/**
 * Settings service — platform settings stored in the Setting table,
 * e.g. platformFeePercent = "3" or freeCancellationHours = "24".
 *
 * Values are saved as text, so this file turns them into numbers. If a setting is
 * missing (or is not a number), a safe default is used, so the app never breaks.
 * The admin's page to change settings comes in Phase 7.
 */
import { db } from "@/lib/db";
import {
  DEFAULT_CANCELLATION_FEE_PERCENT,
  DEFAULT_FREE_CANCELLATION_HOURS,
  type CancellationRules,
} from "@/lib/services/cancellation-rules";

/** Platform fee used when the setting is missing: 3% of work + delivery. */
export const DEFAULT_PLATFORM_FEE_PERCENT = 3;

/**
 * Reads a number setting.
 * Example: getNumberSetting("platformFeePercent", 3) -> 3 (from the text "3" in the table)
 */
export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const setting = await db.setting.findUnique({ where: { key } });
  if (!setting) {
    return fallback;
  }
  const value = Number(setting.value);
  return Number.isFinite(value) ? value : fallback;
}

/** The % of (work + delivery) that KrishiJontro keeps from each booking. */
export async function getPlatformFeePercent(): Promise<number> {
  return getNumberSetting("platformFeePercent", DEFAULT_PLATFORM_FEE_PERCENT);
}

/** Replacement machines are searched this many km around the field, when the setting is missing. */
export const DEFAULT_REPLACEMENT_RADIUS_KM = 15;

/** The admin may give up the replacement search this many hours after a breakdown, when the setting is missing. */
export const DEFAULT_REPLACEMENT_TIMEOUT_HOURS = 2;

/** How far around the field (km) we look for an emergency replacement machine. */
export async function getReplacementRadiusKm(): Promise<number> {
  return getNumberSetting("replacementRadiusKm", DEFAULT_REPLACEMENT_RADIUS_KM);
}

/** How many hours we wait for a provider to send a replacement before giving up. */
export async function getReplacementTimeoutHours(): Promise<number> {
  return getNumberSetting("replacementTimeoutHours", DEFAULT_REPLACEMENT_TIMEOUT_HOURS);
}

/** The farmer's cancellation rules: free until how many hours before the start, and the late fee %. */
export async function getCancellationRules(): Promise<CancellationRules> {
  const [freeHours, feePercent] = await Promise.all([
    getNumberSetting("freeCancellationHours", DEFAULT_FREE_CANCELLATION_HOURS),
    getNumberSetting("cancellationFeePercent", DEFAULT_CANCELLATION_FEE_PERCENT),
  ]);
  return { freeHours, feePercent };
}
