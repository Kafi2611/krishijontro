// The machines found by the search, as numbered cards (the same numbers as the pins on
// the map). Each card also shows the distance, the star rating, the provider and the
// estimated total the farmer pays for this job.
import { MapPin, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { MachineCard } from "@/components/machine-card";
import type { SearchResult } from "@/lib/services/search";

type SearchResultsListProps = {
  results: SearchResult[];
  machineHref: (machineId: string) => string; // the page a card opens
};

export function SearchResultsList({ results, machineHref }: SearchResultsListProps) {
  const t = useTranslations("Search");

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {results.map((result, index) => (
        <li key={result.id}>
          <MachineCard
            href={machineHref(result.id)}
            marker={index + 1}
            machine={{
              id: result.id,
              brand: result.brand,
              model: result.model,
              rate: result.rate,
              approvalStatus: "APPROVED", // the search only finds approved, active machines
              status: "ACTIVE",
              photoUrl: result.photoUrl,
              machineType: result.machineType,
              location: result.location,
            }}
            extra={
              <div className="space-y-1.5 border-t pt-2 text-sm">
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" aria-hidden />
                    {t("away", { km: result.distanceKm })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                    {result.rating
                      ? t("rating", { average: result.rating.average, count: result.rating.count })
                      : t("noRating")}
                  </span>
                </div>
                <p className="truncate text-muted-foreground">{result.providerName}</p>
                <p className="flex items-baseline justify-between gap-2">
                  <span>{t("youPay")}</span>
                  <span className="text-lg font-bold text-primary">{t("total", { amount: result.price.totalAmount })}</span>
                </p>
              </div>
            }
          />
        </li>
      ))}
    </ul>
  );
}
