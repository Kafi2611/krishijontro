// Govt page: "Price limits" (/govt/pricing) — one card per machine type with the
// price limit in force today, and a button to change it.
import { CircleAlert, Pencil } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PricingRuleSummary } from "@/components/govt/pricing-rule-summary";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { listMachineTypesWithRules } from "@/lib/services/pricing-rule";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GovtPricing");
  return { title: t("title") };
}

export default async function GovtPricingPage() {
  // The govt layout already checks the role; we check again because this page reads data.
  await requireRole("GOVT");
  const items = await listMachineTypesWithRules();
  const t = await getTranslations("GovtPricing");
  const tUnit = await getTranslations("BillingUnits");
  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <ul className="grid gap-4 lg:grid-cols-2">
        {items.map(({ machineType, rule }) => (
          <li key={machineType.id}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <MachineTypeIcon icon={machineType.icon} className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{pickByLocale(machineType.name, machineType.nameBn, locale)}</p>
                    <p className="text-sm text-muted-foreground">{tUnit(machineType.billingUnit)}</p>
                  </div>
                  {!machineType.isActive && <Badge variant="secondary">{t("hiddenType")}</Badge>}
                </div>

                {rule ? (
                  <PricingRuleSummary rule={rule} billingUnit={machineType.billingUnit} />
                ) : (
                  <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {t("noRule")}
                  </p>
                )}

                <Button asChild variant={rule ? "outline" : "default"} className="mt-auto self-start">
                  <Link href={`/govt/pricing/${machineType.id}`}>
                    <Pencil aria-hidden />
                    {rule ? t("change") : t("setLimit")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
