// For every request, next-intl asks this file: "which language, and which words?"
// We read the language from the URL (/en or /bn) and load messages/en.json or messages/bn.json.
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "@/lib/i18n";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  // If the URL has an unknown language, fall back to the default (English).
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Show all dates and times in Bangladesh time.
    timeZone: "Asia/Dhaka",
  };
});
