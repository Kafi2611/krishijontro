// Admin page: every booking (/admin/bookings?status=DISPUTED&q=KJ-2026&page=2).
// Filter buttons for each status (with how many bookings have it), a search by booking code
// or the farmer's name or mobile number, and one card per booking that opens its page.
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { BookingCard } from "@/components/booking/booking-card";
import { FilterLinks, PageLinks, SearchBox, type FilterLink } from "@/components/list-filters";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BookingStatus } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth";
import { listHref, readChoice, readPageNumber, readSearchText } from "@/lib/list-params";
import { countBookingsByStatus, listBookingsForAdmin } from "@/lib/services/booking-queries";
import { getAmountDue } from "@/lib/services/booking-rules";

type AdminBookingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Every booking status, in the order of a booking's life. */
const STATUSES = Object.values(BookingStatus);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminBookings");
  return { title: t("title") };
}

export default async function AdminBookingsPage({ searchParams }: AdminBookingsPageProps) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const filter = {
    status: readChoice(params.status, STATUSES),
    query: readSearchText(params.q),
    page: readPageNumber(params.page),
  };
  const [{ bookings, total, pageCount }, statusCounts] = await Promise.all([
    listBookingsForAdmin(filter),
    countBookingsByStatus(),
  ]);

  const t = await getTranslations("AdminBookings");
  const tStatus = await getTranslations("Status");
  const format = await getFormatter();

  // Only statuses that some booking has get a button (a list of 12 buttons is long on a phone).
  const statusLinks: FilterLink[] = [
    { href: listHref("/admin/bookings", { q: filter.query }), label: t("allStatuses"), active: filter.status === null },
    ...STATUSES.filter((status) => (statusCounts[status] ?? 0) > 0 || status === filter.status).map((status) => ({
      href: listHref("/admin/bookings", { status, q: filter.query }),
      label: `${tStatus(status)} (${format.number(statusCounts[status] ?? 0)})`,
      active: filter.status === status,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <FilterLinks links={statusLinks} label={t("filterLabel")} />
      <SearchBox path="/admin/bookings" query={filter.query} placeholder={t("searchPlaceholder")} keep={{ status: filter.status }} />
      <p className="text-sm text-muted-foreground">{t("found", { count: total })}</p>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center font-semibold">{t("empty")}</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <BookingCard
                href={`/admin/bookings/${booking.id}`}
                code={booking.code}
                machineName={`${booking.machine.brand} ${booking.machine.model}`}
                icon={booking.machine.machineType.icon}
                startAt={booking.startAt}
                status={booking.status}
                detail={t("people", { farmer: booking.farmer.name, provider: booking.machine.provider.name })}
                amount={getAmountDue(booking, booking.totalAmount)}
              />
            </li>
          ))}
        </ul>
      )}

      <PageLinks
        page={filter.page}
        pageCount={pageCount}
        hrefFor={(page) => listHref("/admin/bookings", { status: filter.status, q: filter.query, page })}
      />
    </div>
  );
}
