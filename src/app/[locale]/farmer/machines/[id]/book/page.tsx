// Farmer page: book one machine in 3 steps (/farmer/machines/<id>/book?<the search>).
// When the farmer comes from the search, the form starts with that search (land, field, day);
// otherwise with the farmer's own land size and upazila, tomorrow at 8 AM.
import { ArrowLeft, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookingForm } from "@/components/farmer/booking-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { getBookingFormData } from "@/lib/services/booking-queries";
import { toDhakaDay } from "@/lib/services/calendar";
import { searchInputToQuery, searchParamsToInput } from "@/lib/validators/search";

type BookMachinePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Booking");
  return { title: t("stepConfirm") };
}

export default async function BookMachinePage({ params, searchParams }: BookMachinePageProps) {
  const farmer = await requireRole("FARMER");
  const { id } = await params;
  const search = searchParamsToInput(await searchParams);
  const data = await getBookingFormData(id, farmer.id, search);
  if (!data) {
    notFound(); // no such machine, or farmers may not see it
  }
  const t = await getTranslations("Booking");

  // "Back" returns to the machine's page with the same search.
  const backHref = `/farmer/machines/${id}${search ? `?${searchInputToQuery(search)}` : ""}`;
  const backButton = (
    <Button asChild variant="ghost" className="-ml-3">
      <Link href={backHref}>
        <ArrowLeft aria-hidden />
        {t("back")}
      </Link>
    </Button>
  );

  if (!data.canBook || !data.pricedType) {
    return (
      <div className="space-y-6">
        {backButton}
        <p role="status" className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {t("cannotBook")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {backButton}
      <PageHeader title={t("title", { machine: data.machine.name })} description={t("subtitle")} />
      <BookingForm
        machine={data.machine}
        pricedType={data.pricedType}
        subsidyPercent={data.subsidyPercent}
        platformFeePercent={data.platformFeePercent}
        busyTimes={data.busyTimes}
        upazilas={data.upazilas}
        defaultValues={data.defaultValues}
        today={toDhakaDay(new Date())}
      />
    </div>
  );
}
