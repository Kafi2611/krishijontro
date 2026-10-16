// Farmer page: "My bookings" (/farmer/bookings). Bookings still going on come first (the
// soonest at the top), then the earlier ones. Each card opens the booking's own page.
import { CalendarClock, Search } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BookingCard } from "@/components/booking/booking-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { listFarmerBookings } from "@/lib/services/booking-queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FarmerBookings");
  return { title: t("title") };
}

export default async function FarmerBookingsPage() {
  const farmer = await requireRole("FARMER");
  const { current, earlier } = await listFarmerBookings(farmer.id);
  const t = await getTranslations("FarmerBookings");
  const locale = await getLocale();

  /** One booking card; under the name: the machine type, and the amount the farmer pays. */
  function card(booking: (typeof current)[number]) {
    const { machine } = booking;
    return (
      <li key={booking.id}>
        <BookingCard
          href={`/farmer/bookings/${booking.id}`}
          code={booking.code}
          machineName={`${machine.brand} ${machine.model}`}
          icon={machine.machineType.icon}
          startAt={booking.startAt}
          status={booking.status}
          detail={pickByLocale(machine.machineType.name, machine.machineType.nameBn, locale)}
          amount={booking.totalAmount}
        />
      </li>
    );
  }

  const findButton = (
    <Button asChild size="lg">
      <Link href="/farmer/search">
        <Search aria-hidden />
        {t("findButton")}
      </Link>
    </Button>
  );

  if (current.length === 0 && earlier.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <CalendarClock className="size-12 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">{t("empty")}</p>
            {findButton}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={findButton} />

      <section className="space-y-3" aria-labelledby="current-title">
        <h2 id="current-title" className="text-xl font-bold">
          {t("current")}
        </h2>
        {current.length === 0 ? (
          <p className="text-muted-foreground">{t("noCurrent")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">{current.map(card)}</ul>
        )}
      </section>

      {earlier.length > 0 && (
        <section className="space-y-3" aria-labelledby="earlier-title">
          <h2 id="earlier-title" className="text-xl font-bold">
            {t("earlier")}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">{earlier.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
