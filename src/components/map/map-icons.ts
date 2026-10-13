// The pins we draw on Leaflet maps, as SVG/HTML (Leaflet's default pin image does not
// load correctly with Next.js, so we draw our own). Only imported by map files that run
// in the browser, because Leaflet needs `window`.
import L from "leaflet";

/** The green pin: a chosen place (where a machine is kept, or the farmer's field). */
export const PLACE_PIN_ICON = L.divIcon({
  className: "", // no default white box behind the pin
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#15803d" stroke="#ffffff" stroke-width="1.5"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="#ffffff"/></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 34], // the pin's tip touches the chosen point
});

/**
 * An orange circle with a number, for machine number `number` in a result list,
 * so the farmer can match a pin on the map with a card in the list.
 */
export function numberedMachineIcon(number: number) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#c2410c;color:#ffffff;font-weight:700;font-size:14px;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${number}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15], // the circle's centre sits on the machine's place
  });
}
