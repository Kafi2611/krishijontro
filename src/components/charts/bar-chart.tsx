"use client";
// A bar chart for the dashboards and reports, drawn with Recharts.
//   layout "columns" — bars stand up, for months (Jun, Jul, Aug...)
//   layout "rows"    — bars lie down, for long names (machines, districts)
// One series is drawn in KrishiJontro green; two series (e.g. bookings vs machines) in blue and
// orange, with a legend. Touching a bar shows its exact value. Under the chart, "Show the
// numbers" opens the same data as a table (for screen readers, and for anyone who prefers it).
// Recharts draws in the browser, so this is a Client Component; the page passes plain data.
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { useFormatter } from "@/lib/format";
import { niceTicks } from "@/lib/services/stats-rules";

/** One series of bars: its name (for the legend and the table), colour and one value per label. */
export type ChartSeries = { name: string; color: string; values: number[] };

type BarChartProps = {
  caption: string; // what the chart shows, e.g. "Earnings per month (Tk)"
  labels: string[]; // one per bar (or pair of bars), already in the reader's language
  series: ChartSeries[]; // 1 or 2 series
  valueKind: "money" | "count";
  layout?: "columns" | "rows";
};

/** The box that appears when a bar is touched: the label, then each series' value. */
function ChartTooltip({
  active,
  payload,
  label,
  series,
  valueText,
}: TooltipContentProps & { series: ChartSeries[]; valueText: (value: number) => string }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{label}</p>
      {payload.map((entry, index) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: series[index]?.color }} aria-hidden />
          {series.length > 1 && <span className="text-muted-foreground">{series[index]?.name}:</span>}
          <span className="font-medium tabular-nums">{valueText(Number(entry.value))}</span>
        </p>
      ))}
    </div>
  );
}

/** The data key of series number `index` inside each Recharts row, e.g. "s0". */
function seriesKey(index: number): string {
  return `s${index}`;
}

export function BarChart({ caption, labels, series, valueKind, layout = "columns" }: BarChartProps) {
  const t = useTranslations("Charts");
  const tPrice = useTranslations("Price");
  const format = useFormatter(); // Bangla digits on Bangla pages

  // Recharts wants one object per label: { label: "Oct", s0: 1200, s1: 3 }.
  const rows = labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    series.forEach((item, seriesIndex) => {
      row[seriesKey(seriesIndex)] = item.values[index] ?? 0;
    });
    return row;
  });

  /** A value as text: "1,517 Tk" for money, "12" for counts. */
  function valueText(value: number): string {
    return valueKind === "money" ? tPrice("amount", { amount: value }) : format.number(value);
  }

  /** An axis number: in full below 10,000, short above (12K). */
  function tickText(value: number): string {
    return value >= 10000 ? format.number(value, { notation: "compact" }) : format.number(value);
  }

  // Clean numbers on the value axis (0, 100, 200...), up to at least the biggest bar.
  let biggest = 0;
  for (const item of series) {
    biggest = Math.max(biggest, ...item.values);
  }
  const ticks = niceTicks(biggest);
  const valueDomain: [number, number] = [0, ticks[ticks.length - 1]];

  const isRows = layout === "rows";
  // Lying bars need room for every name; standing bars have a fixed height.
  const height = isRows ? Math.max(160, labels.length * 40 + 40) : 240;
  const axisStyle = { fontSize: 12, fill: CHART_COLORS.label };

  return (
    <figure className="space-y-3">
      {/* Two series need a legend; one series is named by the card's title. */}
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-4 text-sm">
          {series.map((item) => (
            <li key={item.name} className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden />
              {item.name}
            </li>
          ))}
        </ul>
      )}

      <div role="img" aria-label={caption} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={rows}
            layout={isRows ? "vertical" : "horizontal"}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            barGap={2} // a 2px gap between the bars of one group
          >
            {/* Thin, quiet guide lines in one direction only */}
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={isRows} horizontal={!isRows} />
            {isRows ? (
              <>
                <XAxis type="number" ticks={ticks} domain={valueDomain} tickFormatter={tickText} tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={120} tick={axisStyle} axisLine={{ stroke: CHART_COLORS.axis }} tickLine={false} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: CHART_COLORS.axis }} tickLine={false} />
                <YAxis ticks={ticks} domain={valueDomain} tickFormatter={tickText} tick={axisStyle} axisLine={false} tickLine={false} width={48} />
              </>
            )}
            <Tooltip
              content={(props) => <ChartTooltip {...props} series={series} valueText={valueText} />}
              cursor={{ fill: CHART_COLORS.grid, fillOpacity: 0.5 }}
            />
            {series.map((item, index) => (
              <Bar
                key={item.name}
                dataKey={seriesKey(index)}
                name={item.name}
                fill={item.color}
                maxBarSize={24} // thin bars, never filling the whole slot
                radius={isRows ? [0, 4, 4, 0] : [4, 4, 0, 0]} // rounded at the value end, square at the baseline
                isAnimationActive={false}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">{t("showTable")}</summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 font-medium">{t("item")}</th>
              {series.map((item) => (
                <th key={item.name} className="py-1 text-right font-medium">
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, index) => (
              <tr key={label} className="border-b last:border-b-0">
                <td className="py-1">{label}</td>
                {series.map((item) => (
                  <td key={item.name} className="py-1 text-right tabular-nums">
                    {valueText(item.values[index] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
