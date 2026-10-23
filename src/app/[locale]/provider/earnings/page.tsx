// Provider page: earnings (/provider/earnings).
// Three numbers at the top (earned so far, waiting to be sent, already sent), then the paid jobs
// that are not in a payout yet (with how the amount to send is worked out), then the payouts
// the admin has sent. The money rules are in lib/services/payout.ts and payment-rules.ts.
import { CircleCheckBig, Hourglass, Info, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getProviderEarnings } from "@/lib/services/payout";
import { getProviderProfile } from "@/lib/services/provider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Earnings");
  return { title: t("title") };
}

export default async function ProviderEarningsPage() {
  const provider = await requireRole("PROVIDER");
  const [earnings, profile] = await Promise.all([getProviderEarnings(provider.id), getProviderProfile(provider.id)]);
  const t = await getTranslations("Earnings");
  const tPrice = await getTranslations("Price");
  const format = await getFormatter();
  const locale = await getLocale();
  const account = profile?.payoutAccount;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("earned")} value={earnings.earnedTotal} icon={<Wallet className="size-5" aria-hidden />} />
        <StatCard
          label={t("waiting")}
          value={earnings.waitingTotal}
          icon={<Hourglass className="size-5" aria-hidden />}
          highlight={earnings.waitingTotal > 0}
        />
        <StatCard label={t("paidOut")} value={earnings.paidOutTotal} icon={<CircleCheckBig className="size-5" aria-hidden />} />
      </div>

      <p className="rounded-lg bg-muted p-3 text-sm">
        {account ? (
          t("account", { account })
        ) : (
          <Link href="/provider/business" className="text-primary underline">
            {t("noAccount")}
          </Link>
        )}
      </p>

      <section className="space-y-3" aria-labelledby="waiting-title">
        <h2 id="waiting-title" className="text-xl font-bold">
          {t("waitingTitle")}
        </h2>
        <div className="flex gap-2 rounded-lg bg-accent p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>{t("howText")}</p>
        </div>
        {earnings.waiting.length === 0 ? (
          <p className="text-muted-foreground">{t("waitingEmpty")}</p>
        ) : (
          <Card>
            <CardContent>
              {/* The table can scroll sideways on a narrow phone */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("booking")}</TableHead>
                    <TableHead className="text-right">{t("share")}</TableHead>
                    <TableHead className="text-right">{t("cash")}</TableHead>
                    <TableHead className="text-right">{t("refunded")}</TableHead>
                    <TableHead className="text-right">{t("owed")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.waiting.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <Link href={`/provider/bookings/${booking.id}`} className="font-medium text-primary">
                          {localizeDigits(booking.code, locale)}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {booking.machine.brand} {booking.machine.model} ·{" "}
                          {format.dateTime(booking.completedAt ?? booking.startAt, { dateStyle: "medium" })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{format.number(booking.money.share)}</TableCell>
                      <TableCell className="text-right tabular-nums">{format.number(booking.money.cashTaken)}</TableCell>
                      <TableCell className="text-right tabular-nums">{format.number(booking.money.refunded)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{format.number(booking.money.owed)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">
                      {t("total")}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {tPrice("amount", { amount: earnings.waitingTotal })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="payouts-title">
        <h2 id="payouts-title" className="text-xl font-bold">
          {t("payoutsTitle")}
        </h2>
        {earnings.payouts.length === 0 ? (
          <p className="text-muted-foreground">{t("payoutsEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {earnings.payouts.map((payout) => (
              <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{format.dateTime(payout.paidAt ?? payout.createdAt, { dateStyle: "medium" })}</p>
                  <p className="text-sm text-muted-foreground">
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
