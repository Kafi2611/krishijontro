// Provider page: "Bookings" (/provider/bookings). At the top, emergency offers: a machine broke
// down near one of the provider's free machines (they can send it). Then the bookings of the
// provider's machines, grouped by what the provider has to do: new requests (accept or reject),
// accepted ones that still need an operator, jobs coming up or going on, and earlier ones.
import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookingCard } from "@/components/booking/booking-card";
import { PageHeader } from "@/components/page-header";
import { ReplacementOffers } from "@/components/provider/replacement-offers";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listProviderBookings } from "@/lib/services/booking-queries";
import { getProviderShare } from "@/lib/services/booking-rules";
import { listReplacementOffers } from "@/lib/services/replacement";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ProviderBookings");
  return { title: t("title") };
}

export default async function ProviderBookingsPage() {
  const provider = await requireRole("PROVIDER");
  const [groups, offers] = await Promise.all([listProviderBookings(provider.id), listReplacementOffers(provider.id)]);
  const t = await getTranslations("ProviderBookings");

  const sections = [
    { key: "requests", title: t("requests"), bookings: groups.requests },
    { key: "needOperator", title: t("needOperator"), bookings: groups.needOperator },
    { key: "ongoing", title: t("ongoing"), bookings: groups.ongoing },
    { key: "earlier", title: t("earlier"), bookings: groups.earlier },
  ];
  const hasAny = sections.some((section) => section.bookings.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <ReplacementOffers offers={offers} />

      {!hasAny && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarClock className="size-12 text-muted-foreground" aria-hidden />
            <p className="max-w-md text-muted-foreground">{t("empty")}</p>
          </CardContent>
        </Card>
      )}

      {hasAny &&
        sections.map((section) => (
          <section key={section.key} className="space-y-3" aria-labelledby={`${section.key}-title`}>
            <h2 id={`${section.key}-title`} className="text-xl font-bold">
              {section.title}
            </h2>
            {section.bookings.length === 0 ? (
              <p className="text-muted-foreground">{t("noneHere")}</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {section.bookings.map((booking) => (
                  <li key={booking.id}>
                    {/* Under the name: the farmer, and what the provider gets */}
                    <BookingCard
                      href={`/provider/bookings/${booking.id}`}
                      code={booking.code}
                      machineName={`${booking.machine.brand} ${booking.machine.model}`}
                      icon={booking.machine.machineType.icon}
                      startAt={booking.startAt}
                      status={booking.status}
                      detail={booking.farmer.name}
                      amount={getProviderShare(booking)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
    </div>
  );
}
