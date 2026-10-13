/**
 * Settings service — platform settings stored in the Setting table,
 * e.g. platformFeePercent = "3" or freeCancellationHours = "24".
 *
 * Values are saved as text, so this file turns them into numbers. If a setting is
 * missing (or is not a number), a safe default is used, so the app never breaks.
 * The admin's page to change settings comes in Phase 7.
 */
import { db } from "@/lib/db";

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
