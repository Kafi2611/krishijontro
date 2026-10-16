// Operator page: one job (/operator/jobs/<id>) — the screen the operator uses in the field.
// At the top, the one thing to do now (On the way / Arrived / Start with the start code /
// Finish with the real work and the finish code). Below: the farmer to call, the job, the
// field on the map (with a link to open it in a map app) and the steps so far.
// The OTP codes are never read here: the farmer tells them to the operator at the field.
import { ExternalLink, Navigation } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookingFacts } from "@/components/booking/booking-facts";
import { BookingHeader } from "@/components/booking/booking-header";
import { BookingTimeline } from "@/components/booking/booking-timeline";
import { ContactLine } from "@/components/booking/contact-line";
import { MapPicker } from "@/components/map/map-picker";
import { JobActions } from "@/components/operator/job-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getOperatorJob } from "@/lib/services/booking-queries";

type OperatorJobPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BookingView");
  return { title: t("title") };
}

export default async function OperatorJobPage({ params }: OperatorJobPageProps) {
  const operator = await requireRole("OPERATOR");
  const { id } = await params;
  const details = await getOperatorJob(id, operator.id);
  if (!details) {
    notFound(); // no such job, or it belongs to another operator
  }
  const { job, timeline, nextStep, bookedAmount } = details;
  const field = { lat: job.fieldLat, lng: job.fieldLng };
  // OpenStreetMap with a pin on the field; on a phone it can be opened in a map app.
  const mapLink = `https://www.openstreetmap.org/?mlat=${field.lat}&mlon=${field.lng}#map=17/${field.lat}/${field.lng}`;

  const t = await getTranslations("BookingView");
  const tJobs = await getTranslations("OperatorJobs");
  const tTimeline = await getTranslations("Timeline");

  return (
    <div className="space-y-6">
      <BookingHeader backHref="/operator/jobs" backLabel={tJobs("back")} booking={job} />

      {nextStep && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="size-5 text-primary" aria-hidden />
              {tJobs("nextTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <JobActions bookingId={job.id} step={nextStep} billingUnit={job.billingUnit} bookedAmount={bookedAmount} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("peopleTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactLine label={t("farmer")} name={job.farmer.name} phone={job.farmer.phone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("jobTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingFacts booking={job} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("mapTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MapPicker value={field} center={field} zoom={15} />
            <Button asChild variant="outline" className="w-full">
              <a href={mapLink} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                {tJobs("openMap")}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tTimeline("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingTimeline steps={timeline} />
        </CardContent>
      </Card>
    </div>
  );
}
