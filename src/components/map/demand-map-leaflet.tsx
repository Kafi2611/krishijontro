"use client";
// The demand heatmap (Leaflet + free OpenStreetMap tiles): one circle per upazila. The more
// bookings and waiting farmers an upazila has, the BIGGER and DARKER its circle (5 orange steps,
// see heatLevel in stats-rules.ts). A thin white ring keeps circles apart where they touch.
// Touching a circle shows the upazila's name and numbers.
// Leaflet needs the browser's `window`, so this file is only loaded in the browser (see demand-map.tsx).
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { CHART_COLORS } from "@/lib/chart-colors";
import { BANGLADESH_CENTER } from "@/lib/services/geo";
import { heatLevel } from "@/lib/services/stats-rules";

/** One circle: where, how much demand, and the text shown when it is touched. */
export type DemandCircle = {
  id: string;
  lat: number;
  lng: number;
  demand: number;
  label: string; // e.g. "Paba: 12 bookings, 1 waiting"
};

export type DemandMapProps = {
  places: DemandCircle[];
};

/** Zooms the map so every circle fits (or shows the whole country when there are none). */
function FitToPlaces({ places }: DemandMapProps) {
  const map = useMap();
  useEffect(() => {
    if (places.length === 0) {
      map.setView([BANGLADESH_CENTER.lat, BANGLADESH_CENTER.lng], 7);
      return;
    }
    const bounds = L.latLngBounds(places.map((place) => L.latLng(place.lat, place.lng)));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, [map, places]);
  return null;
}

/** The circle's size in pixels: 8 for a little demand, up to 28 for the most (by area, so √). */
function circleRadius(demand: number, max: number): number {
  return 8 + 20 * Math.sqrt(demand / max);
}

export default function DemandMapLeaflet({ places }: DemandMapProps) {
  let max = 0;
  for (const place of places) {
    max = Math.max(max, place.demand);
  }

  return (
    <MapContainer
      center={[BANGLADESH_CENTER.lat, BANGLADESH_CENTER.lng]}
      zoom={7}
      scrollWheelZoom={false} // so scrolling the page does not zoom the map by mistake
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToPlaces places={places} />
      {places.map((place) => (
        <CircleMarker
          key={place.id}
          center={[place.lat, place.lng]}
          radius={circleRadius(place.demand, max)}
          pathOptions={{
            color: "#ffffff", // the white ring
            weight: 2,
            fillColor: CHART_COLORS.heat[heatLevel(place.demand, max)],
            fillOpacity: 0.85,
          }}
        >
          <Tooltip>{place.label}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
