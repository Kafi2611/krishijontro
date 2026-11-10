// "Skip to main content": the first thing a keyboard user reaches with the Tab key. It is hidden
// until it gets the focus, then it shows at the top left. Pressing it jumps over the navbar and
// the side menu straight to the page's own content (<main id="main-content">).
import { useTranslations } from "next-intl";

/** The id of the <main> element the link jumps to (used by every layout). */
export const MAIN_CONTENT_ID = "main-content";

export function SkipLink() {
  const t = useTranslations("Common");
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-primary-foreground"
    >
      {t("skipToContent")}
    </a>
  );
}
