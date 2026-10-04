// Tells TypeScript which languages and message keys exist, so a typo like
// t("Auth.logn") is caught as an error before the app even runs.
import type { routing } from "@/lib/i18n";
import type messages from "../../messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
