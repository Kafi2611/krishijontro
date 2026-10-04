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
 * Picks the Bangla or English version of a name stored in the database.
 * Example: pickByLocale("Rajshahi", "রাজশাহী", "bn") -> "রাজশাহী"
 */
export function pickByLocale(english: string, bangla: string | null | undefined, locale: string): string {
  if (locale === "bn" && bangla) {
    return bangla;
  }
  return english;
}
