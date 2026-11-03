// The Govt dashboard: the first page a GOVT user sees after login.
// It shows how many machine types have a price limit, how many machines charge outside today's
// limit, and how much subsidy money has been spent (each box opens its page), a link to the
// reports (charts and the demand heatmap), plus features.
import { BadgePercent, ChartColumn, CircleAlert, Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { countMachinesOutsideLimits, listMachineTypesWithRules } from "@/lib/services/pricing-rule";
import { getSubsidyTotals } from "@/lib/services/subsidy-program";

export default async function GovtDashboardPage() {
  await requireRole("GOVT");
  const [machineTypes, machinesOutside, subsidy] = await Promise.all([
    listMachineTypesWithRules(),
    countMachinesOutsideLimits(),
    getSubsidyTotals(),
  ]);
  const typesWithLimit = machineTypes.filter((item) => item.rule !== null).length;
  const t = await getTranslations("GovtDashboard");

  return (
    <RoleDashboard role="GOVT">
      <div className="grid gap-3 sm:grid-cols-3">
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
        <StatCard
          label={t("subsidySpent")}
          value={subsidy.used}
          icon={<BadgePercent className="size-5" aria-hidden />}
          href="/govt/subsidies"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("reportsTitle")}</CardTitle>
          <CardDescription>{t("reportsText")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg">
            <Link href="/govt/reports">
              <ChartColumn aria-hidden />
              {t("reportsLink")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </RoleDashboard>
  );
}
