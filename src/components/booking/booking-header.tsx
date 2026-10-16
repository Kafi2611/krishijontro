// The top of a booking's page: a "Back" link, the machine's icon and name, its type,
// the booking code and the status. Used by the farmer, provider and operator booking pages.
import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/generated/prisma/enums";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

type BookingHeaderProps = {
  backHref: string;
  backLabel: string;
  booking: {
    code: string;
    status: BookingStatus;
    machine: { brand: string; model: string; machineType: { name: string; nameBn: string; icon: string } };
  };
};

export function BookingHeader({ backHref, backLabel, booking }: BookingHeaderProps) {
  const t = useTranslations("BookingView");
  const locale = useLocale();
  const { machine } = booking;

  return (
    <div className="space-y-3">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href={backHref}>
          <ArrowLeft aria-hidden />
          {backLabel}
        </Link>
      </Button>
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <MachineTypeIcon icon={machine.machineType.icon} className="size-6" />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold">
            {machine.brand} {machine.model}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            {pickByLocale(machine.machineType.name, machine.machineType.nameBn, locale)} ·{" "}
            {t("code", { code: localizeDigits(booking.code, locale) })}
            <StatusBadge status={booking.status} />
          </p>
        </div>
      </div>
    </div>
  );
}
