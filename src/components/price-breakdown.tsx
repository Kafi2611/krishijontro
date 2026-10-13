// Shows a price line by line, so the farmer sees exactly where every taka comes from:
//   Work      0.66 acre × 2,400 Tk                 1,584 Tk
//   Delivery  8 km − 3 free km = 5 km × 50 Tk        250 Tk
//   Subsidy (20%)                                  − 317 Tk
//   You pay                                        1,517 Tk
// The numbers come from calculateBookingPrice() in lib/services/pricing.ts.
// Used by the price calculator and the machine details page (and the booking form later).
import { useTranslations } from "next-intl";
import type { BillingUnit } from "@/generated/prisma/enums";
import type { BookingPrice } from "@/lib/services/pricing";
import { cn } from "@/lib/utils";

type PriceBreakdownProps = {
  price: BookingPrice; // the result of calculateBookingPrice()
  quantity: number; // what the farmer asked for (before the minimum charge)
  billingUnit: BillingUnit;
  rate: number;
  distanceKm: number;
  freeKm: number;
  deliveryRatePerKm: number;
  subsidyPercent: number;
};

type PriceLineProps = {
  label: string;
  detail?: string; // small grey explanation, e.g. "0.66 acre × 2,400 Tk"
  note?: string; // small amber warning, e.g. "billed as the minimum"
  amount: string;
  className?: string;
};

/** One line of the bill: a name with a small explanation on the left, the amount on the right. */
function PriceLine({ label, detail, note, amount, className }: PriceLineProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <dt>
        <span className="font-medium">{label}</span>
        {detail && <span className="block text-sm text-muted-foreground">{detail}</span>}
        {note && <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-950">{note}</span>}
      </dt>
      <dd className="shrink-0 font-semibold tabular-nums">{amount}</dd>
    </div>
  );
}

export function PriceBreakdown({
  price,
  quantity,
  billingUnit,
  rate,
  distanceKm,
  freeKm,
  deliveryRatePerKm,
  subsidyPercent,
}: PriceBreakdownProps) {
  const t = useTranslations("Price"); // its {amount, number} parts show Bangla digits on Bangla pages

  // The farmer asked for less than the minimum, so the minimum is billed.
  const minimumApplies = price.billedQuantity > quantity;
  const deliveryDetail =
    price.chargedKm > 0
      ? t("deliveryDetail", { distance: distanceKm, freeKm, km: price.chargedKm, rate: deliveryRatePerKm })
      : t("deliveryFree", { distance: distanceKm, freeKm });

  return (
    <div className="space-y-3">
      <dl className="space-y-3">
        <PriceLine
          label={t("work")}
          detail={t("workDetail", { quantity: price.billedQuantity, unit: billingUnit, rate })}
          note={minimumApplies ? t("minimumNote", { quantity: price.billedQuantity, unit: billingUnit }) : undefined}
          amount={t("amount", { amount: price.workCharge })}
        />
        <PriceLine label={t("delivery")} detail={deliveryDetail} amount={t("amount", { amount: price.deliveryCharge })} />
        {price.subsidyAmount > 0 && (
          <PriceLine
            label={t("subsidy", { percent: subsidyPercent })}
            detail={t("subsidyDetail")}
            amount={t("minusAmount", { amount: price.subsidyAmount })}
            className="text-green-700"
          />
        )}
      </dl>
      <div className="flex items-center justify-between gap-4 border-t pt-3">
        <span className="text-lg font-semibold">{t("total")}</span>
        <span className="text-2xl font-bold text-primary tabular-nums">{t("amount", { amount: price.totalAmount })}</span>
      </div>
    </div>
  );
}
