// Govt page: reports (/govt/reports).
//   - three numbers: bookings so far, subsidy spent, upazilas with demand
//   - the demand heatmap: where farmers book machines (and still wait for one)
//   - bookings by district
//   - demand vs supply per machine type: bookings in the last 90 days vs machines ready to rent
//   - prices per machine type: today's allowed range and the average rate farmers booked
//   - subsidy given per month
// Every chart can also be opened as a table ("Show the numbers").
import { BadgePercent, CalendarCheck, MapPinned } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BarChart } from "@/components/charts/bar-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { DemandMap } from "@/components/map/demand-map";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { CHART_COLORS } from "@/lib/chart-colors";
import { getFormatter } from "@/lib/format-server";
import { pickByLocale } from "@/lib/i18n";
import { getGovtReports, REPORT_DAYS } from "@/lib/services/stats";
import { monthMiddle } from "@/lib/services/stats-rules";
import { getSubsidyTotals } from "@/lib/services/subsidy-program";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GovtReports");
  return { title: t("title") };
}

export default async function GovtReportsPage() {
  await requireRole("GOVT");
  const [reports, subsidy] = await Promise.all([getGovtReports(), getSubsidyTotals()]);
  const t = await getTranslations("GovtReports");
  const tMoney = await getTranslations("Money");
  const format = await getFormatter();
  const locale = await getLocale();
  const nameOf = (item: { name: string; nameBn: string }) => pickByLocale(item.name, item.nameBn, locale);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("totalBookings")} value={reports.totalBookings} icon={<CalendarCheck className="size-5" aria-hidden />} />
        <StatCard label={t("subsidySpent")} value={subsidy.used} icon={<BadgePercent className="size-5" aria-hidden />} href="/govt/subsidies" />
        <StatCard label={t("placesWithDemand")} value={reports.demandMap.length} icon={<MapPinned className="size-5" aria-hidden />} />
      </div>

      <ChartCard title={t("mapTitle")} description={t("mapText")}>
        <DemandMap
          places={reports.demandMap.map((place) => ({
            id: place.id,
            lat: place.lat,
            lng: place.lng,
            demand: place.demand,
            label: t("placeLabel", { name: nameOf(place), bookings: place.bookings, waiting: place.waiting }),
          }))}
        />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("mapTable")}</summary>
          <ol className="mt-2 space-y-1">
            {reports.demandMap.map((place) => (
              <li key={place.id} className="flex justify-between gap-4 border-b py-1 last:border-b-0">
                <span>{nameOf(place)}</span>
                <span className="tabular-nums">{t("placeNumbers", { bookings: place.bookings, waiting: place.waiting })}</span>
              </li>
            ))}
          </ol>
        </details>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={t("districtTitle")} description={t("districtText")}>
          <BarChart
            caption={t("districtTitle")}
            labels={reports.byDistrict.map(nameOf)}
            series={[{ name: t("bookings"), color: CHART_COLORS.brand, values: reports.byDistrict.map((point) => point.value) }]}
            valueKind="count"
            layout="rows"
          />
        </ChartCard>

        <ChartCard title={t("supplyTitle")} description={t("supplyText", { days: REPORT_DAYS })}>
          <BarChart
            caption={t("supplyTitle")}
            labels={reports.demandVsSupply.map(nameOf)}
            series={[
              { name: t("bookingsLately", { days: REPORT_DAYS }), color: CHART_COLORS.first, values: reports.demandVsSupply.map((row) => row.bookings) },
              { name: t("machinesReady"), color: CHART_COLORS.second, values: reports.demandVsSupply.map((row) => row.machines) },
            ]}
            valueKind="count"
            layout="rows"
          />
        </ChartCard>

        <ChartCard title={t("priceTitle")} description={t("priceText", { days: REPORT_DAYS })}>
          <ul className="divide-y">
            {reports.prices.map((row) => (
              <li key={row.name} className="space-y-1 py-3 first:pt-0 last:pb-0">
                <p className="font-semibold">{nameOf(row)}</p>
                <p className="text-sm text-muted-foreground">
                  {t("limit", {
                    min: tMoney("rate", { amount: row.minRate, unit: row.billingUnit }),
                    max: tMoney("rate", { amount: row.maxRate, unit: row.billingUnit }),
                  })}
                </p>
                <p className="text-sm">
                  {row.averageRate === null
                    ? t("noRecentBookings")
                    : t("average", { rate: tMoney("rate", { amount: row.averageRate, unit: row.billingUnit }), count: row.bookingCount })}
                </p>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard title={t("subsidyTitle")} description={t("subsidyText")}>
          <BarChart
            caption={t("subsidyTitle")}
            labels={reports.subsidyByMonth.map((point) => format.dateTime(monthMiddle(point.key), { month: "short" }))}
            series={[{ name: t("subsidy"), color: CHART_COLORS.brand, values: reports.subsidyByMonth.map((point) => point.value) }]}
            valueKind="money"
          />
        </ChartCard>
      </div>
    </div>
  );
}
