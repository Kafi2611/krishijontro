"use client";
// The demand heatmap with its legend: the map (loaded in the browser only), then the 5 colour
// steps with the numbers each one means. The page shows the same numbers as a table under it.
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART_COLORS } from "@/lib/chart-colors";
import { useFormatter } from "@/lib/format";
import { heatLevelRanges } from "@/lib/services/stats-rules";
import type { DemandMapProps } from "./demand-map-leaflet";

// Leaflet only works in the browser, so we load the map there only (ssr: false).
// While it loads, a grey box is shown.
const DemandMapLeaflet = dynamic(() => import("./demand-map-leaflet"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function DemandMap({ places }: DemandMapProps) {
  const t = useTranslations("GovtReports");
  const format = useFormatter();

  let max = 0;
  for (const place of places) {
    max = Math.max(max, place.demand);
  }
  const ranges = heatLevelRanges(max);

  return (
    <div className="space-y-3">
      {/* isolate: keeps the map's own layers below our menus and pop-ups */}
      <div className="isolate h-80 overflow-hidden rounded-lg border sm:h-96" role="img" aria-label={t("mapTitle")}>
        <DemandMapLeaflet places={places} />
      </div>
      {max > 0 && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{t("legendTitle")}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {ranges.map((range, level) =>
              range ? (
                <li key={level} className="flex items-center gap-2">
                  <span className="size-3.5 rounded-full" style={{ backgroundColor: CHART_COLORS.heat[level] }} aria-hidden />
                  {range[0] === range[1]
                    ? format.number(range[0])
                    : t("legendRange", { from: range[0], to: range[1] })}
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
