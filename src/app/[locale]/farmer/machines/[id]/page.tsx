// Farmer page: one machine (/farmer/machines/<id>?<the search>). Shows photos, the
// price for the farmer's job line by line with a "Book this machine" button, the facts,
// which of the next 14 days are free, the machine and the field on a map, and the latest reviews.
// The job (land, hours, field) comes from the search in the address; when the page is
// opened without a search, the farmer's own land size and upazila are used.
import { ArrowLeft, CalendarCheck, CircleAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { DetailRow } from "@/components/detail-row";
import { FreeDays } from "@/components/farmer/free-days";
import { MachinePhotos } from "@/components/machine-photos";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { ResultsMap } from "@/components/map/results-map";
import { PriceBreakdown } from "@/components/price-breakdown";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getFarmerStartingJob, getMachineForFarmer, searchToJob } from "@/lib/services/search";
import { searchInputToQuery, searchParamsToInput } from "@/lib/validators/search";

type FarmerMachinePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MachineView");
  return { title: t("title") };
}

export default async function FarmerMachinePage({ params, searchParams }: FarmerMachinePageProps) {
  const farmer = await requireRole("FARMER");
  const { id } = await params;
  const search = searchParamsToInput(await searchParams);
  const job = search ? searchToJob(search) : await getFarmerStartingJob(farmer.id);

  const details = await getMachineForFarmer(id, farmer.id, job);
  if (!details) {
    notFound(); // no such machine, or farmers may not see it (not approved, not renting...)
  }
  const { machine, estimate, pricedType, rating } = details;

  const t = await getTranslations("MachineView");
  const tMoney = await getTranslations("Money");
  const tPrice = await getTranslations("Price");
  const tProviderTypes = await getTranslations("ProviderTypes");
  const format = await getFormatter();
  const locale = await getLocale();

  const name = `${machine.brand} ${machine.model}`;
  const upazila = machine.location;
  const district = upazila.parent;
  // "Back" returns to the same search (same results), or to a fresh search.
  const backHref = search ? `/farmer/search?${searchInputToQuery(search)}` : "/farmer/search";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href={backHref}>
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>

      {/* Title: machine, type, provider, rating */}
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <MachineTypeIcon icon={machine.machineType.icon} className="size-6" />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold">{name}</h1>
          <p className="text-muted-foreground">
            {pickByLocale(machine.machineType.name, machine.machineType.nameBn, locale)} · {details.providerName}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {rating ? (
              <span className="flex items-center gap-1.5">
                <StarRating rating={rating.average} />
                {t("ratingValue", { average: rating.average, count: rating.count })}
              </span>
            ) : (
              <span className="text-muted-foreground">{t("noReviews")}</span>
            )}
            <span className="flex items-center gap-1 text-primary">
              <ShieldCheck className="size-4" aria-hidden />
              {t("trustScore", { score: details.trustScore })}
            </span>
          </p>
        </div>
      </div>

      {!details.canTakeJobs && (
        <p role="status" className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {t("notTakingJobs")}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* The price for this farmer's job */}
        <Card className="lg:order-2">
          <CardHeader>
            <CardTitle>{t("priceTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("jobSummary", {
                unit: machine.machineType.billingUnit,
                land: job.landDecimal,
                hours: job.hoursOrDays,
                km: estimate?.distanceKm ?? 0,
              })}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {estimate && pricedType ? (
              <PriceBreakdown
                price={estimate.price}
                quantity={estimate.quantity}
                billingUnit={pricedType.billingUnit}
                rate={machine.rate}
                distanceKm={estimate.distanceKm}
                freeKm={pricedType.freeKm}
                deliveryRatePerKm={pricedType.deliveryRatePerKm}
                subsidyPercent={details.subsidy?.discountPercent ?? 0}
              />
            ) : (
              <p className="text-muted-foreground">{t("noPrice")}</p>
            )}
            <p className="text-sm text-muted-foreground">{tPrice("estimateNote")}</p>
            {details.canTakeJobs && (
              // The booking form starts with the same search (land, field, day).
              <Button asChild size="lg" className="w-full">
                <Link href={`/farmer/machines/${machine.id}/book${search ? `?${searchInputToQuery(search)}` : ""}`}>
                  <CalendarCheck aria-hidden />
                  {t("bookButton")}
                </Link>
              </Button>
            )}
            {!search && (
              <Button asChild variant="outline" className="w-full">
                <Link href="/farmer/search">{t("changeJob")}</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Photos */}
        <Card className="lg:order-1">
          <CardHeader>
            <CardTitle>{t("photos")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MachinePhotos images={machine.images} name={name} icon={machine.machineType.icon} emptyText={t("noPhotos")} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Facts */}
        <Card>
          <CardHeader>
            <CardTitle>{t("details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <DetailRow label={t("rate")}>
                {tMoney("rate", { amount: machine.rate, unit: machine.machineType.billingUnit })}
              </DetailRow>
              <DetailRow label={t("year")}>{localizeDigits(machine.year, locale)}</DetailRow>
              <DetailRow label={t("horsePower")}>
                {machine.horsePower ? format.number(machine.horsePower) : t("notSet")}
              </DetailRow>
              <DetailRow label={t("place")}>
                {pickByLocale(upazila.name, upazila.nameBn, locale)}
                {district && `, ${pickByLocale(district.name, district.nameBn, locale)}`}
                {machine.address && <span className="block text-sm font-normal text-muted-foreground">{machine.address}</span>}
              </DetailRow>
              <DetailRow label={t("provider")}>
                {details.providerName}
                <span className="block text-sm font-normal text-muted-foreground">{tProviderTypes(details.providerType)}</span>
              </DetailRow>
            </dl>
          </CardContent>
        </Card>

        {/* Free days */}
        <Card>
          <CardHeader>
            <CardTitle>{t("freeDaysTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FreeDays days={details.freeDays} />
          </CardContent>
        </Card>
      </div>

      {/* Map: the machine (1) and the farmer's field */}
      <Card>
        <CardHeader>
          <CardTitle>{t("mapTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultsMap
            field={job.field}
            machines={[
              {
                id: machine.id,
                number: 1,
                name,
                lat: machine.lat,
                lng: machine.lng,
                distanceKm: estimate?.distanceKm ?? 0,
                totalAmount: estimate?.price.totalAmount ?? 0,
                href: `/farmer/machines/${machine.id}${search ? `?${searchInputToQuery(search)}` : ""}`,
              },
            ]}
          />
        </CardContent>
      </Card>

      {machine.description && (
        <Card>
          <CardHeader>
            <CardTitle>{t("description")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line">{machine.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Latest reviews */}
      <Card>
        <CardHeader>
          <CardTitle>{t("reviewsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {details.latestReviews.length === 0 ? (
            <p className="text-muted-foreground">{t("noReviews")}</p>
          ) : (
            <ul className="divide-y">
              {details.latestReviews.map((review) => (
                <li key={review.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StarRating rating={review.rating} />
                    <span className="text-sm text-muted-foreground">
                      {review.reviewer.name} · {format.dateTime(review.createdAt, { dateStyle: "medium" })}
                    </span>
                  </div>
                  {review.comment && <p>{review.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
