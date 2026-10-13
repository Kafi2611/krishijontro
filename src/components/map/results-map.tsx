"use client";
// ResultsMap: the map of search results (the field, the search circle and numbered
// machine pins). Also used on a machine's page to show the machine and the field.
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResultsMapProps } from "./results-map-leaflet";

// Leaflet only works in the browser, so we load the map there only (ssr: false).
// While it loads, a grey box is shown.
const ResultsMapLeaflet = dynamic(() => import("./results-map-leaflet"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function ResultsMap(props: ResultsMapProps) {
  return (
    // isolate: keeps the map's own layers below our menus and pop-ups
    <div className="isolate h-72 overflow-hidden rounded-lg border sm:h-96">
      <ResultsMapLeaflet {...props} />
    </div>
  );
}
