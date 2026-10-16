// One person to contact on a booking's page: their role, their name and a "Call" button.
// The button is a tel: link, so on a phone it opens the dialler with the number filled in.
import { Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { localizeDigits } from "@/lib/i18n";

type ContactLineProps = {
  label: string; // e.g. "Operator"
  name: string | null; // null = nobody yet (e.g. no operator chosen)
  phone?: string | null;
};

export function ContactLine({ label, name, phone }: ContactLineProps) {
  const t = useTranslations("BookingView");
  const locale = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-semibold">{name ?? t("noOperatorYet")}</p>
      </div>
      {name && phone && (
        <Button asChild variant="outline">
          <a href={`tel:${phone}`}>
            <Phone aria-hidden />
            {t("call", { phone: localizeDigits(phone, locale) })}
          </a>
        </Button>
      )}
    </div>
  );
}
