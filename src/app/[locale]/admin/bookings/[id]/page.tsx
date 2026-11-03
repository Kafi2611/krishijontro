// Admin page: one booking (/admin/bookings/<id>), to check what happened, e.g. for a complaint.
// It shows the status, the linked bookings (breakdown replacement, group booking), the payments
// with their refunds, the complaint (if any), the steps so far (timeline), the people to call, the job, the farmer's
// bill and the provider's share, and the field on the map. The admin only reads here: every
// change goes through its own page (Payments, Breakdowns, Disputes).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BookingBill } from "@/components/booking/booking-bill";
import { BookingFacts } from "@/components/booking/booking-facts";
import { BookingHeader } from "@/components/booking/booking-header";
import { BookingTimeline } from "@/components/booking/booking-timeline";
import { ContactLine } from "@/components/booking/contact-line";
import { DisputeCard } from "@/components/booking/dispute-card";
import { RelatedBookings } from "@/components/booking/related-bookings";
import { DetailRow } from "@/components/detail-row";
import { MapPicker } from "@/components/map/map-picker";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getAdminBooking } from "@/lib/services/booking-queries";
import { getBookingDispute } from "@/lib/services/dispute";
import { listBookingPayments } from "@/lib/services/payment";

type AdminBookingPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BookingView");
  return { title: t("title") };
}

export default async function AdminBookingPage({ params }: AdminBookingPageProps) {
  await requireRole("ADMIN");
  const { id } = await params;
  const details = await getAdminBooking(id);
  if (!details) {
    notFound();
  }
  const { booking, timeline } = details;
  const [payments, dispute] = await Promise.all([listBookingPayments(booking.id), getBookingDispute(booking.id)]);
  const provider = booking.machine.provider;
  const field = { lat: booking.fieldLat, lng: booking.fieldLng };
  const subsidyPercent = booking.subsidyApplication?.program.discountPercent ?? 0;

  const t = await getTranslations("AdminBookings");
  const tView = await getTranslations("BookingView");
  const tTimeline = await getTranslations("Timeline");
  const tPrice = await getTranslations("Price");
  const tMethod = await getTranslations("PaymentMethods");
  const format = await getFormatter();
  const locale = await getLocale();

  const district = booking.location.parent;
  const place = `${pickByLocale(booking.location.name, booking.location.nameBn, locale)}${
    district ? `, ${pickByLocale(district.name, district.nameBn, locale)}` : ""
  }`;

  return (
    <div className="space-y-6">
      <BookingHeader backHref="/admin/bookings" backLabel={t("back")} booking={booking} />
      <RelatedBookings parent={booking.parentBooking} replacements={booking.replacementBookings} hrefBase="/admin/bookings/" />
      {booking.groupBooking && (
        <p className="rounded-lg bg-accent p-3 text-sm">{t("groupNote", { name: booking.groupBooking.cooperative.name })}</p>
      )}

      {dispute && (
        <div className="space-y-2">
          <DisputeCard dispute={dispute} view="admin" />
          {dispute.status === "OPEN" && (
            <Link href="/admin/disputes" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              {t("decideLink")}
            </Link>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("paymentsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground">{t("noPayments")}</p>
          ) : (
            <ul className="space-y-3">
              {payments.map((payment) => (
                <li key={payment.id} className="space-y-1 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold tabular-nums">{tPrice("amount", { amount: payment.amount })}</span>
                    <StatusBadge status={payment.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tMethod(payment.method)} ·{" "}
                    {format.dateTime(payment.paidAt ?? payment.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  {payment.refunds.map((refund) => (
                    <p key={refund.id} className="text-sm">
                      {t("refundLine", { amount: refund.amount, reason: refund.reason })}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
              <CardTitle>{tView("peopleTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactLine label={tView("farmer")} name={booking.farmer.name} phone={booking.farmer.phone} />
              <ContactLine
                label={tView("provider")}
                name={provider.providerProfile?.businessName ?? provider.name}
                phone={provider.phone}
              />
              <ContactLine label={tView("operator")} name={booking.operator?.name ?? null} phone={booking.operator?.phone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tView("jobTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="mb-3">
                <DetailRow label={t("upazila")}>{place}</DetailRow>
              </dl>
              <BookingFacts booking={booking} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("farmerBill")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingBill booking={booking} view="farmer" subsidyPercent={subsidyPercent} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("providerBill")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingBill booking={booking} view="admin" subsidyPercent={subsidyPercent} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tView("mapTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* No onChange: a map that only shows the pin */}
          <MapPicker value={field} center={field} zoom={14} />
        </CardContent>
      </Card>
    </div>
  );
}
