// The Govt dashboard: the first page a GOVT user sees after login.
// It shows how many machine types have a price limit and how many machines charge
// outside today's limit (each box opens the price limits page), plus upcoming features.
import { CircleAlert, Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireRole } from "@/lib/auth";
import { countMachinesOutsideLimits, listMachineTypesWithRules } from "@/lib/services/pricing-rule";

export default async function GovtDashboardPage() {
  await requireRole("GOVT");
  const [machineTypes, machinesOutside] = await Promise.all([
    listMachineTypesWithRules(),
    countMachinesOutsideLimits(),
  ]);
  const typesWithLimit = machineTypes.filter((item) => item.rule !== null).length;
  const t = await getTranslations("GovtDashboard");

  return (
    <RoleDashboard role="GOVT">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label={t("typesWithLimit", { total: machineTypes.length })}
          value={typesWithLimit}
          icon={<Scale className="size-5" aria-hidden />}
          href="/govt/pricing"
          highlight={typesWithLimit < machineTypes.length}
        />
        <StatCard
          label={t("machinesOutside")}
          value={machinesOutside}
          icon={<CircleAlert className="size-5" aria-hidden />}
          href="/govt/pricing"
          highlight={machinesOutside > 0}
        />
      </div>
    </RoleDashboard>
  );
}
