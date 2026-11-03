// "Ask for help" (/support/new?booking=<id>): opens a new support ticket.
// Coming from a booking's page, that booking is already chosen in the form.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { NewTicketForm } from "@/components/support/new-ticket-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { listTicketBookingChoices } from "@/lib/services/support";

type NewTicketPageProps = {
  searchParams: Promise<{ booking?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Support");
  return { title: t("newTicket") };
}

export default async function NewTicketPage({ searchParams }: NewTicketPageProps) {
  const user = await requireUser();
  const { booking } = await searchParams;
  const bookings = await listTicketBookingChoices(user);
  // Only pre-choose a booking that is really in the user's list.
  const defaultBookingId = bookings.some((choice) => choice.id === booking) ? (booking ?? "") : "";
  const t = await getTranslations("Support");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/support">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("newTicket")} description={t("newSubtitle")} />
      <Card>
        <CardContent>
          <NewTicketForm bookings={bookings} defaultBookingId={defaultBookingId} />
        </CardContent>
      </Card>
    </div>
  );
}
