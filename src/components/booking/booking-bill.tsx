// The bill SAVED with a booking, line by line. (PriceBreakdown works a price out; this one only
// shows the amounts stored in the Booking row, so everyone sees exactly the same numbers.)
//   Farmer:   work + delivery − subsidy = You pay
//   Provider: work + delivery − platform fee = You get   (and what the farmer pays)
//   Admin:    the provider's side, worded "Provider gets"
// In a group booking the delivery line says it is this plot's share of the one trip, and the work
// line shows the plot's share of the group's minimum charge when the plots together were too small.
// Before the work ends it is an estimate; at the finish the operator enters the real amount of
// work and the amounts are worked out again (finishWork in lib/services/booking.ts).
import { useTranslations } from "next-intl";
import { PriceLine } from "@/components/price-breakdown";
import type { BillingUnit } from "@/generated/prisma/enums";
import { getProviderShare } from "@/lib/services/booking-rules";

/** The Booking columns the bill needs. */
type BillBooking = {
  workCharge: number;
  deliveryCharge: number;
  minimumShare: number; // a group plot's share of the group's minimum charge (inside workCharge)
  subsidyAmount: number;
  totalAmount: number;
  platformFee: number;
  rateSnapshot: number;
  billingUnit: BillingUnit;
  distanceKm: number;
  completedAt: Date | null; // set when the work is finished: the bill is then final
};

type BookingBillProps = {
  booking: BillBooking;
  view: "farmer" | "provider" | "admin";
  subsidyPercent: number; // only for the subsidy line's label, e.g. 20
  sharedBy?: number; // a group booking: how many plots share the one delivery charge
};

export function BookingBill({ booking, view, subsidyPercent, sharedBy = 1 }: BookingBillProps) {
  const t = useTranslations("BookingView");
  const tPrice = useTranslations("Price");
  const tMoney = useTranslations("Money");

  const providerAmount = getProviderShare(booking);
  const showsProviderSide = view !== "farmer"; // the provider and the admin see the platform fee
  const rate = tMoney("rate", { amount: booking.rateSnapshot, unit: booking.billingUnit });

  return (
    <div className="space-y-3">
      <dl className="space-y-3">
        <PriceLine
          label={tPrice("work")}
          detail={
            booking.minimumShare > 0
              ? t("rateDetailWithMinimum", { rate, share: booking.minimumShare })
              : t("rateDetail", { rate })
          }
          amount={tPrice("amount", { amount: booking.workCharge })}
        />
        <PriceLine
          label={tPrice("delivery")}
          detail={
            sharedBy > 1
              ? t("deliveryShareDetail", { km: booking.distanceKm, count: sharedBy })
              : t("deliveryDetail", { km: booking.distanceKm })
          }
          amount={tPrice("amount", { amount: booking.deliveryCharge })}
        />
        {view === "farmer" && booking.subsidyAmount > 0 && (
          <PriceLine
            label={tPrice("subsidy", { percent: subsidyPercent })}
            detail={tPrice("subsidyDetail")}
            amount={tPrice("minusAmount", { amount: booking.subsidyAmount })}
            className="text-green-700"
          />
        )}
        {showsProviderSide && (
          <PriceLine
            label={t("platformFee")}
            detail={t("platformFeeDetail")}
            amount={tPrice("minusAmount", { amount: booking.platformFee })}
          />
        )}
      </dl>

      <div className="flex items-center justify-between gap-4 border-t pt-3">
        <span className="text-lg font-semibold">
          {view === "farmer" && tPrice("total")}
          {view === "provider" && t("providerGets")}
          {view === "admin" && t("providerGetsAdmin")}
        </span>
        <span className="text-2xl font-bold text-primary tabular-nums">
          {tPrice("amount", { amount: view === "farmer" ? booking.totalAmount : providerAmount })}
        </span>
      </div>
      {showsProviderSide && (
        <p className="flex justify-between gap-4 text-sm text-muted-foreground">
          <span>{t("farmerPays")}</span>
          <span className="tabular-nums">{tPrice("amount", { amount: booking.totalAmount })}</span>
        </p>
      )}
      <p className="text-sm text-muted-foreground">{booking.completedAt ? t("finalNote") : t("estimateNote")}</p>
    </div>
  );
}
