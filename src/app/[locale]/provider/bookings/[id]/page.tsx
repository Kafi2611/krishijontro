// Provider page: one booking of one of the provider's machines (/provider/bookings/<id>).
// At the top, what the provider must do now: Accept / Reject a new request, choose an
// operator for an accepted one, or "Cash received" for a finished job; and the breakdown box if
// the machine broke down. Below: the steps so far, the farmer and operator to call, the job,
// the provider's share of the bill and the field map.
// The OTP codes are never read here: only the farmer has them.
import { Inbox, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookingBill } from "@/components/booking/booking-bill";
import { BookingFacts } from "@/components/booking/booking-facts";
import { BookingHeader } from "@/components/booking/booking-header";
import { BookingReviews } from "@/components/booking/booking-reviews";
import { BookingTimeline } from "@/components/booking/booking-timeline";
import { BreakdownCard } from "@/components/booking/breakdown-card";
import { ContactLine } from "@/components/booking/contact-line";
import { RelatedBookings } from "@/components/booking/related-bookings";
import { MapPicker } from "@/components/map/map-picker";
import { CollectPaymentCard } from "@/components/payment/collect-payment-card";
import { AssignOperatorForm } from "@/components/provider/assign-operator-form";
import { BookingDecision } from "@/components/provider/booking-decision";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getProviderBooking, listOperatorChoices } from "@/lib/services/booking-queries";
import { getBookingBreakdown } from "@/lib/services/breakdown";
import { canPayBooking } from "@/lib/services/payment-rules";
import { listBookingReviews } from "@/lib/services/review";
import { getReplacementRadiusKm } from "@/lib/services/settings";

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
  // Only an accepted booking needs an operator, so only then we load the choices.
  const operators = booking.status === "ACCEPTED" ? await listOperatorChoices(provider.id, booking) : [];
  const [breakdown, radiusKm, reviews] = await Promise.all([
    getBookingBreakdown(booking.id),
    getReplacementRadiusKm(),
    listBookingReviews(booking.id),
  ]);

  const t = await getTranslations("BookingView");
  const tProvider = await getTranslations("ProviderBookings");
  const tTimeline = await getTranslations("Timeline");
  const tReviews = await getTranslations("Reviews");

  return (
    <div className="space-y-6">
      <BookingHeader backHref="/provider/bookings" backLabel={t("back")} booking={booking} />
      <RelatedBookings parent={booking.parentBooking} replacements={booking.replacementBookings} />

      {breakdown && <BreakdownCard report={breakdown} billingUnit={booking.billingUnit} view="provider" radiusKm={radiusKm} />}

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
      {booking.status === "ACCEPTED" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5 text-amber-700" aria-hidden />
              {tProvider("assignTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{tProvider("assignText")}</p>
            <AssignOperatorForm bookingId={booking.id} operators={operators} />
          </CardContent>
        </Card>
      )}

      {canPayBooking(booking.status) && <CollectPaymentCard bookingId={booking.id} amount={booking.totalAmount} />}

      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{tReviews("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingReviews reviews={reviews} />
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
