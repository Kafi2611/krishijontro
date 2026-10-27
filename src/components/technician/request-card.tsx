// A card for one repair or service request in the technician's lists: the machine's icon and
// name, repair or service, the step it is at, the provider and the place, and when it was asked.
// The whole card is a link to the request's page.
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MaintenanceStatus, MaintenanceType } from "@/generated/prisma/enums";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

type RequestCardProps = {
  request: {
    id: string;
    type: MaintenanceType;
    status: MaintenanceStatus;
    createdAt: Date;
    machine: {
      brand: string;
      model: string;
      machineType: { icon: string };
      location: { name: string; nameBn: string };
      provider: { name: string; providerProfile: { businessName: string | null } | null };
    };
  };
};

export function RequestCard({ request }: RequestCardProps) {
  const t = useTranslations("Maintenance");
  const tTech = useTranslations("Technician");
  const format = useFormatter();
  const locale = useLocale();
  const { machine } = request;
  const providerName = machine.provider.providerProfile?.businessName ?? machine.provider.name;

  return (
    <Link
      href={`/technician/requests/${request.id}`}
      className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
            <MachineTypeIcon icon={machine.machineType.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {machine.brand} {machine.model}
              </p>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-sm">{t(`types.${request.type}`)}</p>
            <p className="text-sm text-muted-foreground">
              {tTech("providerLine", { provider: providerName, place: pickByLocale(machine.location.name, machine.location.nameBn, locale) })}
              {" · "}
              {format.dateTime(request.createdAt, { dateStyle: "medium" })}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
