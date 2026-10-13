"use client";
// The results map (Leaflet + free OpenStreetMap tiles): the farmer's field (green pin),
// the search circle, and one numbered orange pin per machine. Tapping a machine pin opens
// a small box with its name, distance, price and a link to its page.
// Leaflet needs the browser's `window`, so this file is only loaded in the browser (see results-map.tsx).
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "@/lib/navigation";
import type { LatLng } from "@/lib/services/geo";
import { numberedMachineIcon, PLACE_PIN_ICON } from "./map-icons";

/** One machine pin on the map. */
export type MapMachine = {
  id: string;
  number: number; // the same number as on its card in the list
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  totalAmount: number;
  href: string; // the machine's page
};

export type ResultsMapProps = {
  field: LatLng;
  machines: MapMachine[];
  radiusKm?: number; // draws the search circle; leave out to just show the field and the machines
};

/** Zooms the map so everything fits: the whole search circle, or the field and every machine. */
function FitToView({ field, machines, radiusKm }: ResultsMapProps) {
  const map = useMap();
  useEffect(() => {
    if (radiusKm) {
      // A square around the field as wide as the circle (toBounds takes the width in metres).
      map.fitBounds(L.latLng(field.lat, field.lng).toBounds(radiusKm * 2 * 1000));
      return;
    }
    const points = [field, ...machines].map((point) => L.latLng(point.lat, point.lng));
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
  }, [map, field, machines, radiusKm]);
  return null;
}

export default function ResultsMapLeaflet({ field, machines, radiusKm }: ResultsMapProps) {
  const t = useTranslations("SearchMap");

  return (
    <MapContainer
      center={[field.lat, field.lng]}
      zoom={11}
      scrollWheelZoom={false} // so scrolling the page does not zoom the map by mistake
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToView field={field} machines={machines} radiusKm={radiusKm} />

      {radiusKm && (
        <Circle
          center={[field.lat, field.lng]}
          radius={radiusKm * 1000} // Leaflet wants metres
          pathOptions={{ color: "#15803d", weight: 2, fillOpacity: 0.06 }}
        />
      )}

      <Marker position={[field.lat, field.lng]} icon={PLACE_PIN_ICON}>
        <Popup>{t("yourField")}</Popup>
      </Marker>

      {machines.map((machine) => (
        <Marker key={machine.id} position={[machine.lat, machine.lng]} icon={numberedMachineIcon(machine.number)}>
          <Popup>
            <span className="block font-semibold">
              {machine.number}. {machine.name}
            </span>
            <span className="block">{t("facts", { km: machine.distanceKm, amount: machine.totalAmount })}</span>
            <Link href={machine.href} className="font-medium">
              {t("seeDetails")}
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
