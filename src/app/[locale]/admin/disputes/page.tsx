// Admin page: complaints (/admin/disputes).
// "Waiting for a decision" lists the open complaints, oldest first. Each card shows the booking
// (a link to its admin page), the farmer and the provider with their phones, the farmer's reason
// and words, the bill and whether it was paid, and the decision form.
// "Decided lately" shows the last decisions with the admin's note.
import { CircleCheckBig, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DisputeDecisionForm } from "@/components/admin/dispute-decision-form";
import { DisputeCard } from "@/components/booking/dispute-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { listDecidedDisputes, listOpenDisputes } from "@/lib/services/dispute";
import { getBilledWork } from "@/lib/services/dispute-rules";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminDisputes");
  return { title: t("title") };
}

/** "Name · 017…" with a call button, for the farmer or the provider. */
function PersonLine({ label, name, phone, locale }: { label: string; name: string; phone: string; locale: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium">{name}</span>
      </span>
      <Button asChild variant="outline" size="sm">
        <a href={`tel:${phone}`}>
          <Phone aria-hidden />
          {localizeDigits(phone, locale)}
        </a>
      </Button>
    </div>
  );
}

export default async function AdminDisputesPage() {
  await requireRole("ADMIN");
  const [open, decided] = await Promise.all([listOpenDisputes(), listDecidedDisputes()]);
  const t = await getTranslations("AdminDisputes");
  const tPrice = await getTranslations("Price");
  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("openTitle")}</h2>
        {open.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CircleCheckBig className="size-12 text-primary" aria-hidden />
              <p className="font-semibold">{t("noneOpen")}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-4">
            {open.map((dispute) => {
              const booking = dispute.booking;
              const provider = booking.machine.provider;
              return (
                <li key={dispute.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle as="h3" className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/admin/bookings/${booking.id}`} className="underline-offset-4 hover:underline">
                          {t("booking", { code: localizeDigits(booking.code, locale) })}
                        </Link>
                        <span className="text-base font-normal text-muted-foreground">
                          {booking.machine.brand} {booking.machine.model}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <PersonLine label={t("farmer")} name={dispute.raisedBy.name} phone={dispute.raisedBy.phone} locale={locale} />
                        <PersonLine
                          label={t("provider")}
                          name={provider.providerProfile?.businessName ?? provider.name}
                          phone={provider.phone}
                          locale={locale}
                        />
                      </div>
                      <DisputeCard dispute={dispute} view="admin" />
                      <dl className="grid gap-2 rounded-lg bg-muted p-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">{t("billNow")}</dt>
                          <dd className="font-semibold">{tPrice("amount", { amount: booking.totalAmount })}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t("paidQuestion")}</dt>
                          <dd className="font-semibold">{dispute.wasPaid ? t("paidYes") : t("paidNo")}</dd>
                        </div>
                      </dl>
                      {booking.payoutId && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{t("paidOutNote")}</p>}
                      <DisputeDecisionForm
                        disputeId={dispute.id}
                        wasPaid={dispute.wasPaid}
                        refundable={dispute.refundable}
                        providerShare={dispute.providerShare}
                        billingUnit={booking.billingUnit}
                        currentWork={getBilledWork(booking)}
                      />
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("decidedTitle")}</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {decided.map((dispute) => (
              <li key={dispute.id} className="space-y-2">
                <Link href={`/admin/bookings/${dispute.booking.id}`} className="text-sm font-semibold underline-offset-4 hover:underline">
                  {t("booking", { code: localizeDigits(dispute.booking.code, locale) })}
                </Link>
                <DisputeCard dispute={dispute} view="admin" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
