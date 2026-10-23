// The Farmer dashboard: the first page a FARMER user sees after login.
// It shows a big "Find a machine" box (with a link to the price calculator), the farmer's
// government subsidy (or a link to apply), the current bookings (the 3 soonest, with a link to
// all of them) and the list of farmer features.
import { BadgePercent, Calculator, Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BookingCard } from "@/components/booking/booking-card";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { listFarmerBookings } from "@/lib/services/booking-queries";
import { findUsableSubsidy } from "@/lib/services/subsidy";

/** How many current bookings the dashboard shows. */
const BOOKINGS_ON_DASHBOARD = 3;

export default async function FarmerDashboardPage() {
  const farmer = await requireRole("FARMER");
  const [{ current }, subsidy] = await Promise.all([listFarmerBookings(farmer.id), findUsableSubsidy(farmer.id)]);
  const t = await getTranslations("FarmerDashboard");
  const locale = await getLocale();

  return (
    <RoleDashboard role="FARMER">
      <Card className="bg-accent">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Search className="size-7" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-lg font-semibold">{t("findTitle")}</p>
            <p className="text-muted-foreground">{t("findText")}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button asChild size="lg">
              <Link href="/farmer/search">
                <Search aria-hidden />
                {t("findButton")}
              </Link>
            </Button>
            <Button asChild variant="link" className="h-auto p-0">
              <Link href="/price-calculator">
                <Calculator aria-hidden />
                {t("calculator")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <BadgePercent className="size-8 shrink-0 text-primary" aria-hidden />
          <p className="flex-1">{subsidy ? t("subsidyActive", { percent: subsidy.discountPercent }) : t("subsidyText")}</p>
          <Button asChild variant="outline">
            <Link href="/farmer/subsidy">{t("subsidyButton")}</Link>
          </Button>
        </CardContent>
      </Card>

      {current.length > 0 && (
        <section className="space-y-3" aria-labelledby="current-bookings-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="current-bookings-title" className="text-xl font-bold">
              {t("currentTitle")}
            </h2>
            <Button asChild variant="link" className="h-auto p-0">
              <Link href="/farmer/bookings">{t("seeAll")}</Link>
            </Button>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {current.slice(0, BOOKINGS_ON_DASHBOARD).map((booking) => (
              <li key={booking.id}>
                <BookingCard
                  href={`/farmer/bookings/${booking.id}`}
                  code={booking.code}
                  machineName={`${booking.machine.brand} ${booking.machine.model}`}
                  icon={booking.machine.machineType.icon}
                  startAt={booking.startAt}
                  status={booking.status}
                  detail={pickByLocale(booking.machine.machineType.name, booking.machine.machineType.nameBn, locale)}
                  amount={booking.totalAmount}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </RoleDashboard>
  );
}
