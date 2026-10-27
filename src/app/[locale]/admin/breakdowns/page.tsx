// Admin page: breakdowns (/admin/breakdowns).
// First the OPEN ones: machines that broke down during a job and still wait for a replacement,
// with how many machines nearby could still go and how long the farmer has waited. Once the
// waiting time (a setting, 2 hours) has passed, the admin presses "No replacement found".
// Below: the latest closed breakdowns (a replacement came, or none).
import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { NoReplacementButton } from "@/components/admin/no-replacement-button";
import { DetailRow } from "@/components/detail-row";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { getReplacementDeadline } from "@/lib/services/breakdown-rules";
import { findReplacementMachines, listClosedBreakdowns, listOpenBreakdowns } from "@/lib/services/replacement";
import { getReplacementTimeoutHours } from "@/lib/services/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminBreakdowns");
  return { title: t("title") };
}

export default async function AdminBreakdownsPage() {
  await requireRole("ADMIN");
  const [open, closed, timeoutHours] = await Promise.all([
    listOpenBreakdowns(),
    listClosedBreakdowns(),
    getReplacementTimeoutHours(),
  ]);
  // For each open breakdown: how many machines nearby could still be sent.
  const machineCounts = await Promise.all(open.map(async (breakdown) => (await findReplacementMachines(breakdown)).length));

  const t = await getTranslations("AdminBreakdowns");
  const tView = await getTranslations("BookingView");
  const format = await getFormatter();
  const locale = await getLocale();
  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle", { hours: timeoutHours })} />

      <section className="space-y-3" aria-labelledby="open-title">
        <h2 id="open-title" className="text-xl font-bold">
          {t("openTitle")}
        </h2>
        {open.length === 0 && <p className="text-muted-foreground">{t("noneOpen")}</p>}
        <ul className="grid gap-3 lg:grid-cols-2">
          {open.map((breakdown, index) => {
            const { booking } = breakdown;
            const deadline = getReplacementDeadline(breakdown.createdAt, timeoutHours);
            const waitedLongEnough = now >= deadline;
            return (
              <li key={breakdown.id}>
                <Card className={waitedLongEnough ? "border-amber-300 bg-amber-50" : undefined}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <TriangleAlert className="size-5 text-orange-700" aria-hidden />
                      {localizeDigits(booking.code, locale)}
                      <StatusBadge status={breakdown.status} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl>
                      <DetailRow label={t("machine")}>
                        {booking.machine.brand} {booking.machine.model}
                        <span className="block text-sm font-normal text-muted-foreground">
                          {pickByLocale(booking.machine.machineType.name, booking.machine.machineType.nameBn, locale)}
                        </span>
                      </DetailRow>
                      <DetailRow label={tView("farmer")}>{booking.farmer.name}</DetailRow>
                      <DetailRow label={t("problem")}>{breakdown.description}</DetailRow>
                      <DetailRow label={t("brokeAt")}>
                        {format.dateTime(breakdown.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                      </DetailRow>
                      <DetailRow label={t("machinesNearby")}>{format.number(machineCounts[index])}</DetailRow>
                    </dl>
                    <p className="text-sm">
                      {waitedLongEnough
                        ? t("waitedLongEnough", { hours: timeoutHours })
                        : t("waitUntil", { time: format.dateTime(deadline, { timeStyle: "short" }) })}
                    </p>
                    <NoReplacementButton reportId={breakdown.id} code={localizeDigits(booking.code, locale)} />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {closed.length > 0 && (
        <section className="space-y-3" aria-labelledby="closed-title">
          <h2 id="closed-title" className="text-xl font-bold">
            {t("closedTitle")}
          </h2>
          <Card>
            <CardContent>
              <ul className="divide-y">
                {closed.map((breakdown) => (
                  <li key={breakdown.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-semibold">
                        {localizeDigits(breakdown.booking.code, locale)} · {breakdown.booking.machine.brand}{" "}
                        {breakdown.booking.machine.model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {breakdown.booking.farmer.name}
                        {breakdown.resolvedAt &&
                          ` · ${format.dateTime(breakdown.resolvedAt, { dateStyle: "medium", timeStyle: "short" })}`}
                      </p>
                    </div>
                    <StatusBadge status={breakdown.status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
