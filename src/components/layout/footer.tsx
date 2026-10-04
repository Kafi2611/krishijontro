// The small footer at the bottom of public pages.
import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("Common");
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      {t("footer")}
    </footer>
  );
}
