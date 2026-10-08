// Admin page: the list of machine types (Tractor, Reaper, Pump...) with a button
// to add a new one and an "Edit" button on each.
import { Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { listMachineTypesWithCounts } from "@/lib/services/machine-type";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MachineTypesAdmin");
  return { title: t("title") };
}

export default async function MachineTypesPage() {
  // The admin layout already checks the role; we check again because this page reads data.
  await requireRole("ADMIN");
  const machineTypes = await listMachineTypesWithCounts();
  const t = await getTranslations("MachineTypesAdmin");
  const tCategory = await getTranslations("MachineCategories");
  const tWork = await getTranslations("WorkTypes");
  const tUnit = await getTranslations("BillingUnits");
  const tCommon = await getTranslations("Common");
  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild size="lg">
            <Link href="/admin/machine-types/new">
              <Plus aria-hidden />
              {t("add")}
            </Link>
          </Button>
        }
      />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {machineTypes.map((machineType) => (
          <li key={machineType.id}>
            <Card className={machineType.isActive ? "h-full" : "h-full opacity-70"}>
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <MachineTypeIcon icon={machineType.icon} className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {pickByLocale(machineType.name, machineType.nameBn, locale)}
                    </p>
                    {/* The name in the other language, so the admin can check both */}
                    <p className="text-sm text-muted-foreground">
                      {locale === "bn" ? machineType.name : machineType.nameBn}
                    </p>
                  </div>
                  <Badge variant={machineType.isActive ? "default" : "secondary"}>
                    {machineType.isActive ? t("active") : t("hidden")}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{tCategory(machineType.category)}</Badge>
                  <Badge variant="outline">{tUnit(machineType.billingUnit)}</Badge>
                  {machineType.workTypes.map((workType) => (
                    <Badge key={workType} variant="secondary">
                      {tWork(workType)}
                    </Badge>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("machineCount", { count: machineType._count.machines })}
                  </span>
                  <Button asChild variant="outline">
                    <Link href={`/admin/machine-types/${machineType.id}/edit`}>
                      <Pencil aria-hidden />
                      {tCommon("edit")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
