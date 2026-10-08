// A card that shows one machine: photo (or the type's icon), name, type, rate,
// upazila and status labels. The whole card is a link to the machine's page.
// Used in the provider's machine list now, and in the farmer search in Phase 3.
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import type { ApprovalStatus, BillingUnit, MachineStatus } from "@/generated/prisma/enums";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

export type MachineCardData = {
  id: string;
  brand: string;
  model: string;
  rate: number;
  approvalStatus: ApprovalStatus;
  status: MachineStatus;
  photoUrl: string | null; // first photo, or null if there is none
  machineType: { name: string; nameBn: string; icon: string; billingUnit: BillingUnit };
  location: { name: string; nameBn: string };
};

type MachineCardProps = {
  machine: MachineCardData;
  href: string; // where a tap on the card goes
  showStatus?: boolean; // the provider sees approval + status labels; farmers do not
};

export function MachineCard({ machine, href, showStatus = false }: MachineCardProps) {
  const tMoney = useTranslations("Money");
  const locale = useLocale();

  return (
    <Link href={href} className="block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
        <div className="relative aspect-[4/3] bg-accent">
          {machine.photoUrl ? (
            <Image
              src={machine.photoUrl}
              alt={`${machine.brand} ${machine.model}`}
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover"
            />
          ) : (
            // No photo yet: show the machine type's big icon instead
            <div className="flex h-full items-center justify-center text-primary">
              <MachineTypeIcon icon={machine.machineType.icon} className="size-16" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MachineTypeIcon icon={machine.machineType.icon} className="size-4 text-primary" />
            {pickByLocale(machine.machineType.name, machine.machineType.nameBn, locale)}
          </div>
          <p className="text-lg leading-tight font-semibold">
            {machine.brand} {machine.model}
          </p>
          <p className="font-medium text-primary">
            {tMoney("rate", { amount: machine.rate, unit: machine.machineType.billingUnit })}
          </p>
          <p className="text-sm text-muted-foreground">
            {pickByLocale(machine.location.name, machine.location.nameBn, locale)}
          </p>
          {showStatus && (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
              <StatusBadge status={machine.approvalStatus} />
              <StatusBadge status={machine.status} />
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
