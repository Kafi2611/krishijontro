/**
 * Review service — farmers' star ratings (1 to 5) for machines and operators.
 *
 * Phase 3 (now): read the average rating of machines, for the search and machine pages.
 * Phase 6 adds writing reviews and the provider's trust score.
 * A farmer reviews the machine and the operator separately (Review.target),
 * so here we only count reviews whose target is MACHINE.
 */
import { db } from "@/lib/db";

export type MachineRating = {
  average: number; // e.g. 4.5
  count: number; // how many reviews
};

/**
 * The average rating of each machine, as a Map: machineId -> { average, count }.
 * Machines without reviews are not in the Map.
 */
export async function getMachineRatings(machineIds: string[]): Promise<Map<string, MachineRating>> {
  // groupBy = one row per machine, with the average and the count of its reviews (SQL "GROUP BY")
  const rows = await db.review.groupBy({
    by: ["machineId"],
    where: { target: "MACHINE", machineId: { in: machineIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const ratings = new Map<string, MachineRating>();
  for (const row of rows) {
    ratings.set(row.machineId, {
      average: Math.round((row._avg.rating ?? 0) * 10) / 10, // one decimal, e.g. 4.33 -> 4.3
      count: row._count.rating,
    });
  }
  return ratings;
}

/** The latest machine reviews of one machine (newest first), with the farmer's name. */
export async function listLatestMachineReviews(machineId: string, take = 3) {
  return db.review.findMany({
    where: { machineId, target: "MACHINE" },
    include: { reviewer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}
