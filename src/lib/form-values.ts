// Small helpers that turn what a person typed in a form box into clean values.
// Used by React Hook Form's `setValueAs` in our forms.
import { toEnglishDigits } from "@/lib/i18n";

/**
 * Turns the text of a number box into a number.
 * - Bangla digits are allowed: "২৪০০" -> 2400
 * - An empty box gives undefined (so Zod can say "required" or treat it as optional)
 * - Text that is not a number gives NaN (Zod then shows "enter a valid number")
 * Example: numberFromInput(" 12.5 ") -> 12.5
 */
export function numberFromInput(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  const text = toEnglishDigits(String(value ?? "")).trim();
  if (text === "") {
    return undefined;
  }
  return Number(text);
}

/**
 * Cleans a text box that should hold digits, like an OTP code: Bangla digits become English
 * digits and spaces at the ends are removed. (The farmer may read the code out in Bangla.)
 * Example: digitsFromInput(" ১২৩৪ ") -> "1234"
 */
export function digitsFromInput(value: unknown): string {
  return toEnglishDigits(String(value ?? "")).trim();
}
