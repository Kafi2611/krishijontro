// The formatter for dates, times and numbers in components.
// Always import useFormatter from HERE (not from "next-intl"), so Bangla pages show times as
// "সকাল ৮:০০" instead of "৮:০০ AM". (Pages that use "await" take getFormatter from
// lib/format-server.ts, which does the same.)
// Why: next-intl formats with JavaScript's own date formatter, and that one leaves "AM" and "PM"
// in English letters in Bangla. So we wrap it and fix the text it returns (fixBanglaTimes in lib/i18n.ts).
import { useFormatter as useIntlFormatter, useLocale } from "next-intl";
import { fixBanglaTimes } from "@/lib/i18n";

/** What next-intl's formatter gives: format.dateTime(), format.dateTimeRange(), format.number()... */
export type Formatter = ReturnType<typeof useIntlFormatter>;

/**
 * Returns the same formatter, but in Bangla its two date functions fix the times they return.
 * In English nothing changes. (The functions take the same arguments as before, whatever they
 * are, so we pass them on unchanged with "...args".)
 */
export function withBanglaTimes(format: Formatter, locale: string): Formatter {
  if (locale !== "bn") {
    return format;
  }
  const dateTime = (...args: Parameters<Formatter["dateTime"]>) => fixBanglaTimes(format.dateTime(...args));
  const dateTimeRange = (...args: Parameters<Formatter["dateTimeRange"]>) =>
    fixBanglaTimes(format.dateTimeRange(...args));
  return {
    ...format,
    dateTime: dateTime as Formatter["dateTime"],
    dateTimeRange: dateTimeRange as Formatter["dateTimeRange"],
  };
}

/** The formatter for components: like next-intl's useFormatter(), with Bangla times fixed. */
export function useFormatter(): Formatter {
  const format = useIntlFormatter();
  const locale = useLocale();
  return withBanglaTimes(format, locale);
}
