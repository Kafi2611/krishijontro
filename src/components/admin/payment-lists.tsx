// The two lists on the admin's Payments page. These are Server Components: they read the
// database directly.
//   RecentPayments — the latest payments of all farmers, with a Refund button on each
//                    successful one that still has money left to give back
//   PayoutLists    — providers we owe money to (with the payout form), then the latest payouts
import { CircleCheckBig, Phone } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { PayoutForm } from "@/components/admin/payout-form";
import { RefundForm } from "@/components/admin/refund-form";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localizeDigits } from "@/lib/i18n";
import { listRecentPayments } from "@/lib/services/payment";
import { listProvidersToPay, listRecentPayouts } from "@/lib/services/payout";

/** Shown when a list is empty. */
function EmptyNote({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <CircleCheckBig className="size-12 text-primary" aria-hidden />
        <p className="font-semibold">{text}</p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Payments ───────────────────────────

export async function RecentPayments() {
  const payments = await listRecentPayments();
  const t = await getTranslations("AdminPayments");
  const tPrice = await getTranslations("Price");
  const tMethod = await getTranslations("PaymentMethods");
  const format = await getFormatter();
  const locale = await getLocale();

  if (payments.length === 0) {
    return <EmptyNote text={t("paymentsEmpty")} />;
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {payments.map((payment) => (
        <li key={payment.id}>
          <Card className="h-full">
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{t("booking", { code: localizeDigits(payment.booking.code, locale) })}</p>
                  <p className="text-sm text-muted-foreground">
                    {payment.payer.name} · {localizeDigits(payment.payer.phone, locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums">{tPrice("amount", { amount: payment.amount })}</p>
                  <StatusBadge status={payment.status} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {tMethod(payment.method)} · {format.dateTime(payment.paidAt ?? payment.createdAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>

              {payment.refunds.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                  {payment.refunds.map((refund) => (
                    <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{t("refundLine", { amount: refund.amount, reason: refund.reason })}</span>
                      <StatusBadge status={refund.status} />
                    </li>
                  ))}
                </ul>
              )}

              {payment.refundable > 0 && (
                <RefundForm paymentId={payment.id} refundable={payment.refundable} isCash={payment.method === "CASH"} />
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────── Payouts ───────────────────────────

export async function PayoutLists() {
  const [toPay, payouts] = await Promise.all([listProvidersToPay(), listRecentPayouts()]);
  const t = await getTranslations("AdminPayments");
  const tPrice = await getTranslations("Price");
  const format = await getFormatter();
  const locale = await getLocale();

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="to-pay-title">
        <h2 id="to-pay-title" className="text-xl font-bold">
          {t("toPayTitle")}
        </h2>
        {toPay.length === 0 && <EmptyNote text={t("toPayEmpty")} />}
        <ul className="grid gap-4 lg:grid-cols-2">
          {toPay.map(({ provider, bookingCount, owed }) => {
            const account = provider.providerProfile?.payoutAccount;
            return (
              <li key={provider.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>{provider.providerProfile?.businessName ?? provider.name}</CardTitle>
                    <a href={`tel:${provider.phone}`} className="inline-flex items-center gap-1 text-sm text-primary">
                      <Phone className="size-4" aria-hidden />
                      {provider.name} · {localizeDigits(provider.phone, locale)}
                    </a>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-muted-foreground">{t("bookingCount", { count: bookingCount })}</span>
                      <span className="text-2xl font-bold text-primary tabular-nums">{tPrice("amount", { amount: owed })}</span>
                    </p>
                    <p className="text-sm">{account ? t("account", { account }) : t("noAccount")}</p>
                    {/* Below 0: the provider holds our fee from cash jobs; it waits for the next online job. */}
                    {owed > 0 ? (
                      <PayoutForm providerId={provider.id} amount={owed} />
                    ) : (
                      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{t("owedMinus")}</p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="payouts-title">
        <h2 id="payouts-title" className="text-xl font-bold">
          {t("recentPayoutsTitle")}
        </h2>
        {payouts.length === 0 ? (
          <p className="text-muted-foreground">{t("recentPayoutsEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {payouts.map((payout) => (
              <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{payout.provider.providerProfile?.businessName ?? payout.provider.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format.dateTime(payout.paidAt ?? payout.createdAt, { dateStyle: "medium" })} ·{" "}
                    {t("payoutLine", { count: payout._count.bookings, reference: payout.reference ?? "—" })}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{tPrice("amount", { amount: payout.amount })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
