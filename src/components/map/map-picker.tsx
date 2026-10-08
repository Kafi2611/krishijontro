"use client";
// MapPicker: a map where a person taps to choose a place (where a machine is kept,
// or a farmer's field in Phase 3), plus a "Use my location" button.
// Without onChange it is just a read-only map with a pin.
import { LocateFixed } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LatLng } from "@/lib/services/geo";

// Leaflet only works in the browser, so we load the map there only (ssr: false).
// While it loads, a grey box is shown.
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

type MapPickerProps = {
  value: LatLng | null;
  center: LatLng;
  onChange?: (point: LatLng) => void;
  zoom?: number;
};

export function MapPicker({ value, center, onChange, zoom }: MapPickerProps) {
  const t = useTranslations("Map");
  const [isLocating, setIsLocating] = useState(false);

  /** Asks the phone/browser for its GPS position and moves the pin there. */
  function pickMyLocation() {
    if (!navigator.geolocation || !onChange) {
      toast.error(t("locationFailed"));
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        onChange({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setIsLocating(false);
        toast.error(t("locationFailed")); // the person said no, or there is no GPS
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2">
      {/* isolate: keeps the map's own layers below our menus and pop-ups */}
      <div className="isolate h-72 overflow-hidden rounded-lg border sm:h-80">
        <LeafletMap value={value} center={center} onChange={onChange} zoom={zoom} />
      </div>
      {onChange && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{t("tapHint")}</p>
          <Button
            type="button"
            variant="outline"
            className="text-foreground" // stay black even when the map field shows an error
            disabled={isLocating}
            onClick={pickMyLocation}
          >
            <LocateFixed aria-hidden />
            {t("useMyLocation")}
          </Button>
        </div>
      )}
    </div>
  );
}
