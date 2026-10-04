// The top bar shown on every page: logo, language switch, and Login/Register buttons.
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

export async function Navbar() {
  const t = await getTranslations("Common");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-1 px-3 sm:gap-2 sm:px-4">
        <Logo />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <Button asChild>
            <Link href="/login">{t("login")}</Link>
          </Button>
          {/* On small phones there is no room; the home page has its own register button */}
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link href="/register">{t("register")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
