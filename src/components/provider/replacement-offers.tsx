// The emergency offers at the top of the provider's Bookings page: a machine of the same kind
// broke down near one of this provider's free machines. Each offer shows the job that is left
// (work, time, field, what the provider would get) and a "Send this machine" button for each
// machine that could go (nearest first). The offers come from listReplacementOffers().
import { Siren } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { DetailRow } from "@/components/detail-row";
import { SendReplacementButton } from "@/components/provider/send-replacement-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pickByLocale } from "@/lib/i18n";
import type { ReplacementOffer } from "@/lib/services/replacement";

export function ReplacementOffers({ offers }: { offers: ReplacementOffer[] }) {
  const t = useTranslations("Replacement");
  const tView = useTranslations("BookingView");
  const tPrice = useTranslations("Price");
  const tMoney = useTranslations("Money");
  const format = useFormatter();
  const locale = useLocale();

  if (offers.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-labelledby="emergency-title">
      <h2 id="emergency-title" className="flex items-center gap-2 text-xl font-bold text-red-700">
        <Siren className="size-6" aria-hidden />
        {t("title")}
      </h2>
      <p className="text-muted-foreground">{t("subtitle")}</p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {offers.map(({ breakdown, machines, job, providerAmount }) => {
          const { booking } = breakdown;
          const machineType = pickByLocale(booking.machine.machineType.name, booking.machine.machineType.nameBn, locale);
          const startTime = format.dateTime(job.startAt, { timeStyle: "short" });
          return (
            <li key={breakdown.id}>
              <Card className="border-red-300">
                <CardHeader>
                  <CardTitle>{t("offerTitle", { type: machineType })}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl>
                    <DetailRow label={t("farmer")}>{booking.farmer.name}</DetailRow>
                    <DetailRow label={tView("fieldAddress")}>{booking.fieldAddress ?? tView("noFieldAddress")}</DetailRow>
                    <DetailRow label={t("workLeft")}>
                      {tView("quantity", { quantity: job.remaining.quantity, unit: booking.billingUnit })}
                    </DetailRow>
                    <DetailRow label={tView("when")}>
                      {tView("timeRange", {
                        start: format.dateTime(job.startAt, { dateStyle: "medium", timeStyle: "short" }),
                        end: format.dateTime(job.endAt, { timeStyle: "short" }),
                      })}
                    </DetailRow>
                    <DetailRow label={t("rate")}>
                      {tMoney("rate", { amount: booking.rateSnapshot, unit: booking.billingUnit })}
                      <span className="block text-sm font-normal text-muted-foreground">{t("freeDelivery")}</span>
                    </DetailRow>
                    <DetailRow label={tView("providerGets")}>{tPrice("amount", { amount: providerAmount })}</DetailRow>
                  </dl>
                  <ul className="space-y-2">
                    {machines.map((machine) => (
                      <li key={machine.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent p-3">
                        <div>
                          <p className="font-semibold">{machine.name}</p>
                          <p className="text-sm text-muted-foreground">{t("distance", { km: machine.distanceKm })}</p>
                        </div>
                        <SendReplacementButton
                          reportId={breakdown.id}
                          machineId={machine.id}
                          machineName={machine.name}
                          startTime={startTime}
                        />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
