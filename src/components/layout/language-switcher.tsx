"use client";
// The English / বাংলা button in the navbar. It reloads the same page in the other language
// by changing the start of the URL (/en/... <-> /bn/...).
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/lib/navigation";

export function LanguageSwitcher() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname(); // the current path WITHOUT the language, e.g. "/login"
  const [isPending, startTransition] = useTransition();

  const otherLocale = locale === "en" ? "bn" : "en";

  /** Opens the same page in the other language. */
  function switchLanguage() {
    startTransition(() => {
      router.replace(pathname, { locale: otherLocale });
    });
  }

  return (
    <Button
      variant="outline"
      onClick={switchLanguage}
      disabled={isPending}
      title={t("language")}
      lang={otherLocale}
    >
      <Languages className="hidden sm:block" aria-hidden />
      {/* Short label on phones to save space, full label on bigger screens */}
      <span className="sm:hidden">{t("switchToShort")}</span>
      <span className="hidden sm:inline">{t("switchTo")}</span>
    </Button>
  );
}
