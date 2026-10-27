// Farmer page: one booking (/farmer/bookings/<id>). It shows the status, the secret start or
// finish code when the operator will need it, the breakdown box if the machine broke down (with
// links between the broken booking and its replacement), the payment box (pay when the work is
// done; the receipt once paid), the steps so far (timeline), the people to call, the job, the
// bill and the field on the map. Only the farmer who booked can open it.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookingBill } from "@/components/booking/booking-bill";
import { BookingFacts } from "@/components/booking/booking-facts";
import { BookingHeader } from "@/components/booking/booking-header";
import { BookingTimeline } from "@/components/booking/booking-timeline";
import { BreakdownCard } from "@/components/booking/breakdown-card";
import { ContactLine } from "@/components/booking/contact-line";
import { OtpCard } from "@/components/booking/otp-card";
import { RelatedBookings } from "@/components/booking/related-bookings";
import { MapPicker } from "@/components/map/map-picker";
import { BookingPaymentCard } from "@/components/payment/booking-payment-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getFarmerBooking } from "@/lib/services/booking-queries";
import { getBookingBreakdown } from "@/lib/services/breakdown";
import { listBookingPayments } from "@/lib/services/payment";
import { getOnlineGateway } from "@/lib/services/payment-gateway";
import { getReplacementRadiusKm } from "@/lib/services/settings";

type FarmerBookingPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BookingView");
  return { title: t("title") };
}

export default async function FarmerBookingPage({ params }: FarmerBookingPageProps) {
  const farmer = await requireRole("FARMER");
  const { id } = await params;
  const details = await getFarmerBooking(id, farmer.id);
  if (!details) {
    notFound(); // no such booking, or it is someone else's
  }
  const { booking, timeline, otp } = details;
  const [payments, breakdown, radiusKm] = await Promise.all([
    listBookingPayments(booking.id),
    getBookingBreakdown(booking.id),
    getReplacementRadiusKm(),
  ]);
  const provider = booking.machine.provider;
  const field = { lat: booking.fieldLat, lng: booking.fieldLng };

  const t = await getTranslations("BookingView");
  const tTimeline = await getTranslations("Timeline");

  return (
    <div className="space-y-6">
      <BookingHeader backHref="/farmer/bookings" backLabel={t("back")} booking={booking} />
      <RelatedBookings
        parent={booking.parentBooking}
        replacements={booking.replacementBookings}
        hrefBase="/farmer/bookings/"
      />

      {otp && <OtpCard kind={otp.kind} code={otp.code} />}

      {breakdown && <BreakdownCard report={breakdown} billingUnit={booking.billingUnit} view="farmer" radiusKm={radiusKm} />}

      <BookingPaymentCard booking={booking} payments={payments} onlineMethod={getOnlineGateway().method} />

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
              <ContactLine
                label={t("provider")}
                name={provider.providerProfile?.businessName ?? provider.name}
                phone={provider.phone}
              />
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
              <BookingBill
                booking={booking}
                view="farmer"
                subsidyPercent={booking.subsidyApplication?.program.discountPercent ?? 0}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("mapTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* No onChange: a map that only shows the pin */}
          <MapPicker value={field} center={field} zoom={14} />
        </CardContent>
      </Card>
    </div>
  );
}
