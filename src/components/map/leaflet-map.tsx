"use client";
// The real map (Leaflet + free OpenStreetMap tiles, no API key needed).
// Tap the map or drag the pin to choose a place. Leaflet needs the browser's
// `window`, so this file is only loaded in the browser (see map-picker.tsx).
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLng } from "@/lib/services/geo";

// Our own green pin, drawn with SVG. (Leaflet's default pin image does not load
// correctly with Next.js, so we draw one instead.)
const PIN_ICON = L.divIcon({
  className: "", // no default white box behind the pin
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#15803d" stroke="#ffffff" stroke-width="1.5"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="#ffffff"/></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 34], // the pin's tip touches the chosen point
});

/** Rounds a coordinate to 6 decimal places (about 10 cm), enough for a field. */
function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Listens for taps on the map and reports the tapped point. Draws nothing. */
function TapToPick({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onPick({ lat: roundCoordinate(event.latlng.lat), lng: roundCoordinate(event.latlng.lng) });
    },
  });
  return null;
}

/**
 * Moves the map to the chosen point whenever it changes (for example when the
 * provider picks another upazila). If the map shows a very big area, it also zooms in.
 */
function FollowPoint({ point }: { point: LatLng }) {
  const map = useMap();
  useEffect(() => {
    const zoomLevel = map.getZoom() < 11 ? 13 : map.getZoom();
    map.setView([point.lat, point.lng], zoomLevel);
  }, [map, point.lat, point.lng]);
  return null;
}

export type LeafletMapProps = {
  value: LatLng | null; // the chosen point (null = nothing chosen yet)
  center: LatLng; // where the map looks when nothing is chosen
  onChange?: (point: LatLng) => void; // leave out to show a read-only map
  zoom?: number;
};

export default function LeafletMap({ value, center, onChange, zoom = 13 }: LeafletMapProps) {
  const start = value ?? center;
  const canEdit = onChange !== undefined;

  return (
    <MapContainer
      center={[start.lat, start.lng]}
      zoom={value ? zoom : 7} // nothing chosen yet: show the whole country
      scrollWheelZoom={false} // so scrolling the page does not zoom the map by mistake
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {canEdit && <TapToPick onPick={onChange} />}
      {value && <FollowPoint point={value} />}
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={PIN_ICON}
          draggable={canEdit}
          eventHandlers={{
            // After the pin is dragged, report its new place.
            dragend(event) {
              const position = (event.target as L.Marker).getLatLng();
              onChange?.({ lat: roundCoordinate(position.lat), lng: roundCoordinate(position.lng) });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
