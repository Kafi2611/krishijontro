// Provider page: one booking of one of the provider's machines (/provider/bookings/<id>).
// A new request shows the Accept / Reject buttons at the top. Below: the steps so far, the
// farmer and operator to call, the job, the provider's share of the bill and the field map.
// The OTP codes are never read here: only the farmer has them.
import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookingBill } from "@/components/booking/booking-bill";
import { BookingFacts } from "@/components/booking/booking-facts";
import { BookingHeader } from "@/components/booking/booking-header";
import { BookingTimeline } from "@/components/booking/booking-timeline";
import { ContactLine } from "@/components/booking/contact-line";
import { MapPicker } from "@/components/map/map-picker";
import { BookingDecision } from "@/components/provider/booking-decision";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getProviderBooking } from "@/lib/services/booking-queries";

type ProviderBookingPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BookingView");
  return { title: t("title") };
}

export default async function ProviderBookingPage({ params }: ProviderBookingPageProps) {
  const provider = await requireRole("PROVIDER");
  const { id } = await params;
  const details = await getProviderBooking(id, provider.id);
  if (!details) {
    notFound(); // no such booking, or it is for another provider's machine
  }
  const { booking, timeline } = details;
  const field = { lat: booking.fieldLat, lng: booking.fieldLng };

  const t = await getTranslations("BookingView");
  const tProvider = await getTranslations("ProviderBookings");
  const tTimeline = await getTranslations("Timeline");

  return (
    <div className="space-y-6">
      <BookingHeader backHref="/provider/bookings" backLabel={t("back")} booking={booking} />

      {/* What the provider must do now */}
      {booking.status === "REQUESTED" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="size-5 text-amber-700" aria-hidden />
              {tProvider("decideTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{tProvider("decideText", { farmer: booking.farmer.name })}</p>
            <BookingDecision bookingId={booking.id} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tTimeline("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingTimeline steps={timeline} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("peopleTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactLine label={t("farmer")} name={booking.farmer.name} phone={booking.farmer.phone} />
              <ContactLine label={t("operator")} name={booking.operator?.name ?? null} phone={booking.operator?.phone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("jobTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingFacts booking={booking} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("billTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* The provider's view: no subsidy line, so the percent is not needed */}
              <BookingBill booking={booking} view="provider" subsidyPercent={0} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("mapTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MapPicker value={field} center={field} zoom={14} />
        </CardContent>
      </Card>
    </div>
  );
}
