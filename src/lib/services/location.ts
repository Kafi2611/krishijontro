/**
 * Location service — reads places (division > district > upazila > union).
 *
 * Forms need a list of upazilas to choose from, each with its district name
 * (there can be two upazilas with similar names in different districts)
 * and its centre point (so the map can jump there).
 */
import { db } from "@/lib/db";

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
