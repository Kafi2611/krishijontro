// The facts of one price limit as a short list: rate limit, harvest season,
// delivery charge, minimum charge and since when it is in force.
// Used on the government's price limits pages.
import { useFormatter, useTranslations } from "next-intl";
import { DetailRow } from "@/components/detail-row";
import type { BillingUnit } from "@/generated/prisma/enums";
import { getSeasonMaxRate } from "@/lib/services/pricing";

export type PricingRuleFacts = {
  minRate: number;
  maxRate: number;
  seasonCapPercent: number;
  harvestSeasonStart: Date | null;
  harvestSeasonEnd: Date | null;
  deliveryRatePerKm: number;
  freeKm: number;
  minCharge: number;
  activeFrom: Date;
};

type PricingRuleSummaryProps = {
  rule: PricingRuleFacts;
  billingUnit: BillingUnit;
};

export function PricingRuleSummary({ rule, billingUnit }: PricingRuleSummaryProps) {
  const t = useTranslations("GovtPricing");
  const format = useFormatter(); // Bangla digits and month names on Bangla pages

  return (
    <dl>
      <DetailRow label={t("rateLimit")}>
        {t("rateRange", { min: rule.minRate, max: rule.maxRate, unit: billingUnit })}
      </DetailRow>
      <DetailRow label={t("harvestSeason")}>
        {rule.harvestSeasonStart && rule.harvestSeasonEnd ? (
          <>
            {format.dateTimeRange(rule.harvestSeasonStart, rule.harvestSeasonEnd, { dateStyle: "medium" })}
            <span className="block text-sm font-normal text-muted-foreground">
              {t("seasonMax", { max: getSeasonMaxRate(rule), percent: rule.seasonCapPercent })}
            </span>
          </>
        ) : (
          t("noSeason")
        )}
      </DetailRow>
      <DetailRow label={t("delivery")}>
        {t("deliveryValue", { rate: rule.deliveryRatePerKm, freeKm: rule.freeKm })}
      </DetailRow>
      <DetailRow label={t("minimum")}>
        {t("quantity", { amount: rule.minCharge, unit: billingUnit })}
      </DetailRow>
      <DetailRow label={t("since")}>{format.dateTime(rule.activeFrom, { dateStyle: "medium" })}</DetailRow>
    </dl>
  );
}
