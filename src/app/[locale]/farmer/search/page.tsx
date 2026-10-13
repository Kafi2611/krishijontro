// Farmer page: "Find a machine" (/farmer/search?workType=...&landValue=...&...).
// The search lives in the page address. The server reads it, runs searchMachines(),
// and shows a machine suggestion, the results on a map, and the results as a list.
// With nothing in the address, it starts from the farmer's own upazila and land size.
import { BadgePercent, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MachineSearchForm } from "@/components/farmer/machine-search-form";
import { SearchResultsList } from "@/components/farmer/search-results";
import { SuggestionNote } from "@/components/farmer/suggestion-note";
import { ResultsMap } from "@/components/map/results-map";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { toDhakaDay } from "@/lib/services/calendar";
import { listUpazilaOptions } from "@/lib/services/location";
import { listPricedMachineTypes } from "@/lib/services/pricing-rule";
import { getFarmerSearchDefaults, searchMachines } from "@/lib/services/search";
import { cn } from "@/lib/utils";
import { SEARCH_SORTS, searchInputToQuery, searchParamsToInput } from "@/lib/validators/search";

type FarmerSearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Search");
  return { title: t("title") };
}

export default async function FarmerSearchPage({ searchParams }: FarmerSearchPageProps) {
  const farmer = await requireRole("FARMER");
  const params = await searchParams;
  const [machineTypes, upazilas] = await Promise.all([listPricedMachineTypes(), listUpazilaOptions()]);
  const t = await getTranslations("Search");

  if (machineTypes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t("noMachineTypes")}</CardContent>
        </Card>
      </div>
    );
  }

  // The search from the address, or the farmer's starting search if the address has none.
  const fromAddress = searchParamsToInput(params);
  const addressWasWrong = Object.keys(params).length > 0 && fromAddress === null;
  const search = fromAddress ?? (await getFarmerSearchDefaults(farmer.id, machineTypes[0].workTypes[0]));
  const outcome = addressWasWrong ? null : await searchMachines(search, farmer.id);

  const query = searchInputToQuery(search);
  const machineHref = (machineId: string) => `/farmer/machines/${machineId}?${query}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardContent>
          {/* key: a new search in the address starts the form again with its values */}
          <MachineSearchForm
            key={query}
            defaultValues={search}
            machineTypes={machineTypes}
            upazilas={upazilas}
            today={toDhakaDay(new Date())}
          />
        </CardContent>
      </Card>

      {addressWasWrong && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {t("badParams")}
        </p>
      )}

      {outcome && (
        <section className="space-y-4" aria-labelledby="results-title">
          {outcome.suggestion && (
            <SuggestionNote
              machineType={outcome.suggestion.machineType}
              reason={outcome.suggestion.reason}
              search={search}
            />
          )}
          {outcome.subsidy && (
            <p className="flex items-center gap-2 rounded-lg bg-accent p-3 text-sm">
              <BadgePercent className="size-5 shrink-0 text-primary" aria-hidden />
              {t("subsidyIncluded", { percent: outcome.subsidy.discountPercent })}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-title" className="text-xl font-bold">
              {t("results", { count: outcome.results.length })}
            </h2>
            {/* Sort: two links to the same search with another order */}
            <nav className="flex gap-2" aria-label={t("sortLabel")}>
              {SEARCH_SORTS.map((sort) => (
                <Link
                  key={sort}
                  href={`/farmer/search?${searchInputToQuery({ ...search, sort })}`}
                  aria-current={sort === search.sort ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
                    sort === search.sort ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  {t(`sort.${sort}`)}
                </Link>
              ))}
            </nav>
          </div>

          <ResultsMap
            field={{ lat: search.lat, lng: search.lng }}
            radiusKm={search.maxKm}
            machines={outcome.results.map((result, index) => ({
              id: result.id,
              number: index + 1,
              name: `${result.brand} ${result.model}`,
              lat: result.lat,
              lng: result.lng,
              distanceKm: result.distanceKm,
              totalAmount: result.price.totalAmount,
              href: machineHref(result.id),
            }))}
          />

          {outcome.results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <SearchX className="size-12 text-muted-foreground" aria-hidden />
                <p className="font-semibold">{t("results", { count: 0 })}</p>
                <p className="max-w-md text-muted-foreground">{t("emptyHint")}</p>
              </CardContent>
            </Card>
          ) : (
            <SearchResultsList results={outcome.results} machineHref={machineHref} />
          )}

          {outcome.busyCount > 0 && (
            <p className="text-sm text-muted-foreground">{t("busyNote", { count: outcome.busyCount })}</p>
          )}
          <p className="text-sm text-muted-foreground">{t("estimateNote")}</p>
        </section>
      )}
    </div>
  );
}
