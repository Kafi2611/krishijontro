/**
 * Location service — reads places (division > district > upazila > union).
 *
 * Forms need a list of upazilas to choose from, each with its district name
 * (there can be two upazilas with similar names in different districts)
 * and its centre point (so the map can jump there).
 * A booking also needs the upazila of the farmer's field: the one whose centre is nearest.
 */
import { db } from "@/lib/db";
import { findNearestPlace, type LatLng } from "@/lib/services/geo";

export type UpazilaOption = {
  id: string;
  name: string;
  nameBn: string;
  districtName: string;
  districtNameBn: string;
  lat: number | null;
  lng: number | null;
};

/** All upazilas with their district, sorted by district then upazila name. */
export async function listUpazilaOptions(): Promise<UpazilaOption[]> {
  const upazilas = await db.location.findMany({
    where: { level: "UPAZILA" },
    include: { parent: true }, // the parent of an upazila is its district
    orderBy: { name: "asc" },
  });

  const options = upazilas.map((upazila) => ({
    id: upazila.id,
    name: upazila.name,
    nameBn: upazila.nameBn,
    districtName: upazila.parent?.name ?? "",
    districtNameBn: upazila.parent?.nameBn ?? "",
    lat: upazila.lat,
    lng: upazila.lng,
  }));

  return options.sort((a, b) => a.districtName.localeCompare(b.districtName));
}

/** True if the id belongs to an upazila (used to check form data on the server). */
export async function isUpazila(locationId: string): Promise<boolean> {
  const count = await db.location.count({ where: { id: locationId, level: "UPAZILA" } });
  return count > 0;
}

/**
 * The id of the upazila whose centre is nearest to a map point (e.g. a farmer's field),
 * or null if no upazila has a centre point. A booking saves it as the field's upazila.
 */
export async function findNearestUpazilaId(point: LatLng): Promise<string | null> {
  const upazilas = await db.location.findMany({
    where: { level: "UPAZILA" },
    select: { id: true, lat: true, lng: true },
  });
  return findNearestPlace(point, upazilas)?.id ?? null;
}
