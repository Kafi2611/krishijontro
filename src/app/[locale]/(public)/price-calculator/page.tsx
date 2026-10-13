// Public page: the price calculator (/price-calculator). Anyone can open it, no login.
// The server reads today's government limits, the open subsidy program and the platform
// fee; the calculator then works out prices in the browser as the visitor types.
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { PriceCalculator } from "@/components/price-calculator";
import { Card, CardContent } from "@/components/ui/card";
import { listPricedMachineTypes } from "@/lib/services/pricing-rule";
import { getPlatformFeePercent } from "@/lib/services/settings";
import { findOpenSubsidyProgram } from "@/lib/services/subsidy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PriceCalculator");
  return { title: t("title") };
}

export default async function PriceCalculatorPage() {
  const [machineTypes, subsidyProgram, platformFeePercent] = await Promise.all([
    listPricedMachineTypes(),
    findOpenSubsidyProgram(),
    getPlatformFeePercent(),
  ]);
  const t = await getTranslations("PriceCalculator");

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {machineTypes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t("noMachines")}</CardContent>
        </Card>
      ) : (
        <PriceCalculator
          machineTypes={machineTypes}
          subsidyPercent={subsidyProgram?.discountPercent ?? null}
          platformFeePercent={platformFeePercent}
        />
      )}
    </div>
  );
}
