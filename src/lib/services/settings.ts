/**
 * Settings service — platform settings stored in the Setting table,
 * e.g. platformFeePercent = "3" or freeCancellationHours = "24".
 *
 * Values are saved as text, so this file turns them into numbers. If a setting is
 * missing (or is not a number), a safe default is used, so the app never breaks.
 * The admin changes them on the Settings page (updatePlatformSettings); the list of
 * settings, their defaults and their limits live in settings-rules.ts.
 */
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import type { CancellationRules } from "@/lib/services/cancellation-rules";
import {
  DEFAULT_PLATFORM_SETTINGS,
  listSettingChanges,
  PLATFORM_SETTING_KEYS,
  SETTING_DESCRIPTIONS,
  type PlatformSettings,
} from "@/lib/services/settings-rules";
import type { SettingsInput } from "@/lib/validators/settings";
import type { ActionResult } from "@/lib/validators/types";

/** Turns the saved text into a number, or gives the fallback if it is not a number. */
function readNumber(text: string | undefined, fallback: number): number {
  if (text === undefined) {
    return fallback;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Reads a number setting.
 * Example: getNumberSetting("platformFeePercent", 3) -> 3 (from the text "3" in the table)
 */
export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const setting = await db.setting.findUnique({ where: { key } });
  return readNumber(setting?.value, fallback);
}

/** The % of (work + delivery) that KrishiJontro keeps from each booking. */
export async function getPlatformFeePercent(): Promise<number> {
  return getNumberSetting("platformFeePercent", DEFAULT_PLATFORM_SETTINGS.platformFeePercent);
}

/** How far around the field (km) we look for an emergency replacement machine. */
export async function getReplacementRadiusKm(): Promise<number> {
  return getNumberSetting("replacementRadiusKm", DEFAULT_PLATFORM_SETTINGS.replacementRadiusKm);
}

/** How many hours we wait for a provider to send a replacement before giving up. */
export async function getReplacementTimeoutHours(): Promise<number> {
  return getNumberSetting("replacementTimeoutHours", DEFAULT_PLATFORM_SETTINGS.replacementTimeoutHours);
}

/** The farmer's cancellation rules: free until how many hours before the start, and the late fee %. */
export async function getCancellationRules(): Promise<CancellationRules> {
  const [freeHours, feePercent] = await Promise.all([
    getNumberSetting("freeCancellationHours", DEFAULT_PLATFORM_SETTINGS.freeCancellationHours),
    getNumberSetting("cancellationFeePercent", DEFAULT_PLATFORM_SETTINGS.cancellationFeePercent),
  ]);
  return { freeHours, feePercent };
}

// ─────────────────────────── The admin's Settings page ───────────────────────────

/** All the settings the admin can change, as numbers (a missing one gets its default). */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: [...PLATFORM_SETTING_KEYS] } } });
  const savedValues = new Map(rows.map((row) => [row.key, row.value]));

  const settings = { ...DEFAULT_PLATFORM_SETTINGS };
  for (const key of PLATFORM_SETTING_KEYS) {
    settings[key] = readNumber(savedValues.get(key), DEFAULT_PLATFORM_SETTINGS[key]);
  }
  return settings;
}

/**
 * Saves the admin's new settings (already checked by settingsSchema).
 * In one transaction: every changed value is saved ("upsert" = update the row, or create it if
 * it is missing) and ONE audit log row lists what changed, e.g. "platformFeePercent: 3 -> 4".
 * New bookings use the new values at once; a booking already made keeps the amounts it saved.
 */
export async function updatePlatformSettings(adminId: string, input: SettingsInput): Promise<ActionResult> {
  const before = await getPlatformSettings();
  const changes = listSettingChanges(before, input);
  if (changes.length === 0) {
    return { ok: true }; // nothing changed, so there is nothing to save or log
  }

  await db.$transaction(async (tx) => {
    for (const key of PLATFORM_SETTING_KEYS) {
      if (before[key] === input[key]) {
        continue;
      }
      const value = String(input[key]);
      await tx.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value, description: SETTING_DESCRIPTIONS[key] },
      });
    }
    await writeAuditLog(
      { actorId: adminId, action: "SETTINGS_CHANGED", entityType: "Setting", details: changes.join(", ") },
      tx,
    );
  });
  return { ok: true };
}
