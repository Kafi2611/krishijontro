// Provider page: "My machines" — every machine of this provider as a card (with a service
// alert when the engine hours near the next service), and an "Add machine" button.
import { Plus, Tractor, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MachineCard } from "@/components/machine-card";
import { PageHeader } from "@/components/page-header";
import { ProviderApprovalNote } from "@/components/provider/provider-approval-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { listProviderMachines } from "@/lib/services/machine";
import { getHoursUntilService, getServiceState } from "@/lib/services/maintenance-rules";
import { getProviderProfile } from "@/lib/services/provider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Machines");
  return { title: t("title") };
}

export default async function ProviderMachinesPage() {
  const provider = await requireRole("PROVIDER");
  const [machines, profile] = await Promise.all([
    listProviderMachines(provider.id),
    getProviderProfile(provider.id),
  ]);
  const t = await getTranslations("Machines");
  const tMaintenance = await getTranslations("Maintenance");

  /** An orange line under the card when the machine needs a service soon, or now. */
  function serviceAlert(machine: { engineHours: number; serviceDueHours: number }) {
    const state = getServiceState(machine);
    if (state === "ok") {
      return undefined;
    }
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-orange-700">
        <Wrench className="size-4" aria-hidden />
        {state === "due" ? tMaintenance("dueShort") : tMaintenance("soonShort", { hours: getHoursUntilService(machine) })}
      </p>
    );
  }

  const addButton = (
    <Button asChild size="lg">
      <Link href="/provider/machines/new">
        <Plus aria-hidden />
        {t("add")}
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={addButton} />
      {profile && <ProviderApprovalNote approvalStatus={profile.approvalStatus} />}

      {machines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Tractor className="size-12 text-muted-foreground" aria-hidden />
            <p className="font-semibold">{t("empty")}</p>
            <p className="max-w-md text-muted-foreground">{t("emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {machines.map((machine) => (
            <li key={machine.id}>
              <MachineCard
                href={`/provider/machines/${machine.id}`}
                showStatus
                machine={{ ...machine, photoUrl: machine.images[0]?.url ?? null }}
                extra={serviceAlert(machine)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
