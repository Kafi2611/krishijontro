// A card for one booking in a list: the machine's icon and name, the booking code, when the
// work starts, the status and (if given) one more line and an amount.
// The whole card is a link to the booking's page. Used by the farmer, provider and operator lists.
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BookingStatus } from "@/generated/prisma/enums";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

type BookingCardProps = {
  href: string;
  code: string;
  machineName: string;
  icon: string; // the machine type's icon name
  startAt: Date;
  status: BookingStatus;
  detail?: string; // one more line, e.g. the farmer's name on the provider's list
  amount?: number; // e.g. what the farmer pays
};

export function BookingCard({ href, code, machineName, icon, startAt, status, detail, amount }: BookingCardProps) {
  const tPrice = useTranslations("Price");
  const format = useFormatter(); // Bangla digits and month names on Bangla pages
  const locale = useLocale();

  return (
    <Link href={href} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
            <MachineTypeIcon icon={icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{machineName}</p>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {localizeDigits(code, locale)} · {format.dateTime(startAt, { dateStyle: "medium", timeStyle: "short" })}
            </p>
            {(detail || amount !== undefined) && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{detail}</span>
                {amount !== undefined && <span className="font-semibold">{tPrice("amount", { amount })}</span>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
