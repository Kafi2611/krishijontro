// The KrishiJontro logo (tractor icon + name). Clicking it goes to the home page.
import { Tractor } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/navigation";

type LogoProps = {
  hideNameOnPhone?: boolean; // dashboard pages need the space for the menu button
};

export function Logo({ hideNameOnPhone = false }: LogoProps) {
  const t = useTranslations("Common");
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-primary">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Tractor className="size-5" aria-hidden />
      </span>
      <span className={hideNameOnPhone ? "hidden text-lg sm:inline" : "text-lg"}>{t("appName")}</span>
    </Link>
  );
}
