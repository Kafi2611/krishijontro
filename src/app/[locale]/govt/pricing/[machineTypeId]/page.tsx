// Govt page: change the price limit of one machine type (/govt/pricing/<machineTypeId>).
// Shows the form filled with today's limit, and the earlier limits below it.
import { ArrowLeft, History } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { PricingRuleForm } from "@/components/govt/pricing-rule-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { toDhakaDay } from "@/lib/services/calendar";
import { getMachineTypePricing } from "@/lib/services/pricing-rule";
import type { PricingRuleInput } from "@/lib/validators/pricing-rule";

type EditPricingPageProps = {
  params: Promise<{ machineTypeId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GovtPricing");
  return { title: t("title") };
}

/** Turns a saved rule into form values (dates become "YYYY-MM-DD" text for the date boxes). */
function toFormValues(
  rule: NonNullable<Awaited<ReturnType<typeof getMachineTypePricing>>>["currentRule"],
): Partial<PricingRuleInput> {
  if (!rule) {
    // No limit yet: a few common values so the form is quick to fill.
    return { seasonCapPercent: 0, harvestSeasonStart: "", harvestSeasonEnd: "", freeKm: 3, minCharge: 0 };
  }
  return {
    minRate: rule.minRate,
    maxRate: rule.maxRate,
    seasonCapPercent: rule.seasonCapPercent,
    harvestSeasonStart: rule.harvestSeasonStart ? toDhakaDay(rule.harvestSeasonStart) : "",
    harvestSeasonEnd: rule.harvestSeasonEnd ? toDhakaDay(rule.harvestSeasonEnd) : "",
    deliveryRatePerKm: rule.deliveryRatePerKm,
    freeKm: rule.freeKm,
    minCharge: rule.minCharge,
  };
}

export default async function EditPricingPage({ params }: EditPricingPageProps) {
  await requireRole("GOVT");
  const { machineTypeId } = await params;
  const pricing = await getMachineTypePricing(machineTypeId);
  if (!pricing) {
    notFound(); // wrong id in the URL -> "Page not found"
  }
  const { machineType, currentRule, pastRules } = pricing;

  const t = await getTranslations("GovtPricing");
  const format = await getFormatter();
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/govt/pricing">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={t("editTitle", { name: pickByLocale(machineType.name, machineType.nameBn, locale) })}
        description={t("editSubtitle")}
      />

      <Card>
        <CardContent>
          <PricingRuleForm
            machineTypeId={machineType.id}
            billingUnit={machineType.billingUnit}
            defaultValues={toFormValues(currentRule)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" aria-hidden />
            {t("historyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pastRules.length === 0 ? (
            <p className="text-muted-foreground">{t("noHistory")}</p>
          ) : (
            <ul className="divide-y">
              {pastRules.map((rule) => (
                <li key={rule.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="text-muted-foreground">
                    {rule.activeTo
                      ? format.dateTimeRange(rule.activeFrom, rule.activeTo, { dateStyle: "medium" })
                      : format.dateTime(rule.activeFrom, { dateStyle: "medium" })}
                  </span>
                  <span className="font-medium">
                    {t("rateRange", { min: rule.minRate, max: rule.maxRate, unit: machineType.billingUnit })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
