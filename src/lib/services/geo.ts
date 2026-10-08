/**
 * Geo service — small helpers about places and land.
 *
 * 1. Distance: how far a machine is from a farmer's field, using the Haversine
 *    formula (the straight-line distance over the curved surface of the Earth).
 * 2. Land units: farmers in Bangladesh talk in "decimal" (shotangsho), "bigha"
 *    and "acre". We always store land in DECIMAL inside the database.
 *    1 acre = 100 decimal, 1 bigha = 33 decimal.
 * 3. Bangladesh box: a quick check that a map point is really in Bangladesh.
 *
 * These are pure functions (no database, no network), so they are easy to test.
 */

/** How many decimals are in one acre. */
export const DECIMALS_PER_ACRE = 100;

/** How many decimals are in one bigha (the common Bangladesh standard). */
export const DECIMALS_PER_BIGHA = 33;

/** Average radius of the Earth in kilometres, used by the Haversine formula. */
const EARTH_RADIUS_KM = 6371;

/** A point on the map: latitude and longitude in degrees. */
export type LatLng = {
  lat: number;
  lng: number;
};

/**
 * A box around Bangladesh on the map (a little bigger than the country).
 * A machine or field outside this box must be a mistake (e.g. a wrong tap on the map).
 */
export const BANGLADESH_BOUNDS = {
  minLat: 20.5,
  maxLat: 26.7,
  minLng: 88.0,
  maxLng: 92.7,
};

/** Roughly the middle of Bangladesh: where a map starts before anything is chosen. */
export const BANGLADESH_CENTER: LatLng = { lat: 23.8, lng: 90.3 };

/**
 * True if the point is inside the Bangladesh box above.
 * Example: isInsideBangladesh({ lat: 24.37, lng: 88.6 }) -> true (Rajshahi)
 */
export function isInsideBangladesh(point: LatLng): boolean {
  return (
    point.lat >= BANGLADESH_BOUNDS.minLat &&
    point.lat <= BANGLADESH_BOUNDS.maxLat &&
    point.lng >= BANGLADESH_BOUNDS.minLng &&
    point.lng <= BANGLADESH_BOUNDS.maxLng
  );
}

/** The land units a farmer can type in. */
export type LandUnit = "DECIMAL" | "BIGHA" | "ACRE";

/**
 * Converts degrees to radians, because Math.sin / Math.cos work in radians.
 * Example: 180 degrees -> 3.14159 (π) radians.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Returns the distance in kilometres between two map points,
 * rounded to 1 decimal place (example: 7.8 km).
 * Uses the Haversine formula.
 */
export function distanceInKm(from: LatLng, to: LatLng): number {
  const latDifference = toRadians(to.lat - from.lat);
  const lngDifference = toRadians(to.lng - from.lng);

  // "a" is the square of half the straight-line (chord) length between the points.
  const a =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(lngDifference / 2) ** 2;

  // "c" is the angle between the two points, seen from the centre of the Earth.
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_KM * c;
  return Math.round(distance * 10) / 10;
}

/**
 * Converts land from any unit into decimal (the unit we store).
 * Example: toDecimal(2, "BIGHA") -> 66
 */
export function toDecimal(value: number, unit: LandUnit): number {
  if (unit === "ACRE") {
    return value * DECIMALS_PER_ACRE;
  }
  if (unit === "BIGHA") {
    return value * DECIMALS_PER_BIGHA;
  }
  return value;
}

/**
 * Converts decimal into acres. Pricing uses acres for PER_ACRE machines.
 * Example: decimalToAcre(66) -> 0.66
 */
export function decimalToAcre(landDecimal: number): number {
  return landDecimal / DECIMALS_PER_ACRE;
}

/**
 * Converts decimal into bigha (for showing to farmers).
 * Example: decimalToBigha(66) -> 2
 */
export function decimalToBigha(landDecimal: number): number {
  return landDecimal / DECIMALS_PER_BIGHA;
}
