// Officer page: bookings and complaints in the officer's upazila (/officer/bookings).
// The officer only reads here (an admin decides complaints). First the complaints about jobs in
// the upazila (open ones first), then how many bookings there are in each status, then the
// latest bookings with the farmer and the provider.
import { CalendarCheck, CircleCheckBig } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BookingCard } from "@/components/booking/booking-card";
import { DisputeCard } from "@/components/booking/dispute-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { listUpazilaBookings, listUpazilaComplaints } from "@/lib/services/officer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OfficerBookings");
  return { title: t("title") };
}

export default async function OfficerBookingsPage() {
  const officer = await requireRole("OFFICER");
  const [data, complaints] = await Promise.all([listUpazilaBookings(officer.id), listUpazilaComplaints(officer.id)]);
  const t = await getTranslations("OfficerBookings");
  const format = await getFormatter();
  const locale = await getLocale();

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        <p className="rounded-lg bg-amber-50 p-3 text-amber-950">{t("noUpazila")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", { upazila: pickByLocale(data.upazila.name, data.upazila.nameBn, locale) })}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("complaintsTitle")}</h2>
        {complaints.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-6">
              <CircleCheckBig className="size-6 shrink-0 text-primary" aria-hidden />
              <p>{t("noComplaints")}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {complaints.map((complaint) => (
              <li key={complaint.id} className="space-y-2">
                <p className="text-sm font-semibold">
                  {t("complaintAbout", {
                    code: localizeDigits(complaint.booking.code, locale),
                    machine: `${complaint.booking.machine.brand} ${complaint.booking.machine.model}`,
                    farmer: complaint.raisedBy.name,
                  })}
                </p>
                <DisputeCard dispute={complaint} view="officer" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("bookingsTitle", { count: data.total })}</h2>
        {data.statusCounts.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={t("byStatus")}>
            {data.statusCounts.map((item) => (
              <li key={item.status} className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                <StatusBadge status={item.status} />
                <span className="font-semibold">{format.number(item.count)}</span>
              </li>
            ))}
          </ul>
        )}
        {data.bookings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CalendarCheck className="size-12 text-primary" aria-hidden />
              <p className="font-semibold">{t("noBookings")}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.bookings.map((booking) => {
              const provider = booking.machine.provider;
              return (
                <li key={booking.id}>
                  <BookingCard
                    code={booking.code}
                    machineName={`${booking.machine.brand} ${booking.machine.model}`}
                    icon={booking.machine.machineType.icon}
                    startAt={booking.startAt}
                    status={booking.status}
                    detail={t("people", { farmer: booking.farmer.name, provider: provider.providerProfile?.businessName ?? provider.name })}
                    amount={booking.totalAmount}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
