// The formatter for dates, times and numbers in pages that use "await" (async Server Components).
// Always import getFormatter from HERE (not from "next-intl/server"), so Bangla pages show times
// as "সকাল ৮:০০" instead of "৮:০০ AM". See lib/format.ts for why and how.
import { getFormatter as getIntlFormatter, getLocale } from "next-intl/server";
import { withBanglaTimes, type Formatter } from "@/lib/format";

/** The formatter for async pages: like next-intl's getFormatter(), with Bangla times fixed. */
export async function getFormatter(): Promise<Formatter> {
  const [format, locale] = await Promise.all([getIntlFormatter(), getLocale()]);
  return withBanglaTimes(format, locale);
}
