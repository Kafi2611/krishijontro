// Language settings for the whole app (used by next-intl).
// We support English ("en") and Bangla ("bn"). Every URL starts with the language,
// for example /en/login or /bn/login.
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "bn"],
  defaultLocale: "en",
});

/** "en" or "bn" */
export type AppLocale = (typeof routing.locales)[number];

const BANGLA_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/**
 * Replaces English digits with Bangla digits.
 * Example: toBanglaDigits("01700000001") -> "০১৭০০০০০০০১"
 */
export function toBanglaDigits(text: string | number): string {
  return String(text).replace(/[0-9]/g, (digit) => BANGLA_DIGITS[Number(digit)]);
}

/**
 * Replaces Bangla digits with English digits. Farmers may type their phone
 * number with a Bangla keyboard, so we change it before checking it.
 * Example: toEnglishDigits("০১৭") -> "017"
 */
export function toEnglishDigits(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
}

/**
 * Shows digits in the reader's language: Bangla digits when locale is "bn",
 * unchanged when it is "en". Use it for phone numbers and booking codes.
 * (Prices and dates use next-intl's formatter, which already does this.)
 */
export function localizeDigits(text: string | number, locale: string): string {
  if (locale === "bn") {
    return toBanglaDigits(text);
  }
  return String(text);
}

/**
 * The Bangla word for the part of the day an hour falls in, as people say the time.
 * `hour` is 0–23. Example: 8 -> "সকাল" (morning), 13 -> "দুপুর" (noon), 16 -> "বিকাল" (afternoon)
 */
export function getBanglaDayPart(hour: number): string {
  if (hour >= 4 && hour < 6) {
    return "ভোর"; // dawn
  }
  if (hour >= 6 && hour < 12) {
    return "সকাল"; // morning
  }
  if (hour >= 12 && hour < 16) {
    return "দুপুর"; // noon
  }
  if (hour >= 16 && hour < 18) {
    return "বিকাল"; // afternoon
  }
  if (hour >= 18 && hour < 20) {
    return "সন্ধ্যা"; // evening
  }
  return "রাত"; // night
}

// A time as JavaScript writes it in Bangla: Bangla digits, then "AM" or "PM" in English
// letters, e.g. "৮:০০ AM". (Some browsers write পূর্বাহ্ণ / অপরাহ্ণ instead; we accept both.)
const BANGLA_TIME_REGEX = /([০-৯]{1,2}):([০-৯]{2})\s*(AM|PM|পূর্বাহ্ণ|অপরাহ্ণ)/g;

/**
 * JavaScript's date formatter leaves "AM" and "PM" in English in Bangla text ("৮:০০ AM").
 * This rewrites every such time the way people say it in Bangla, with the part of the day
 * in front: "৮:০০ AM" -> "সকাল ৮:০০", "৪:৩০ PM" -> "বিকাল ৪:৩০". Other text is left alone.
 * Example: fixBanglaTimes("২০ অক্টো, ২০২৬, ৮:০০ AM") -> "২০ অক্টো, ২০২৬, সকাল ৮:০০"
 */
export function fixBanglaTimes(text: string): string {
  return text.replace(BANGLA_TIME_REGEX, (_match, hourText: string, minuteText: string, period: string) => {
    const isAfternoon = period === "PM" || period === "অপরাহ্ণ";
    // From the 12-hour clock to 0–23: 12 AM is hour 0, 12 PM is hour 12, 4 PM is hour 16.
    const hour = (Number(toEnglishDigits(hourText)) % 12) + (isAfternoon ? 12 : 0);
    return `${getBanglaDayPart(hour)} ${hourText}:${minuteText}`;
  });
}

/**
 * Picks the Bangla or English version of a name stored in the database.
 * Example: pickByLocale("Rajshahi", "রাজশাহী", "bn") -> "রাজশাহী"
 */
export function pickByLocale(english: string, bangla: string | null | undefined, locale: string): string {
  if (locale === "bn" && bangla) {
    return bangla;
  }
  return english;
}
