// One support ticket (/support/<id>) of the logged-in user: the subject, the status, the
// conversation with the KrishiJontro team, a box to write again and "Close" while it is open.
// Only the user who opened the ticket can see it.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/status-badge";
import { CloseTicketButton, TicketReplyForm } from "@/components/support/ticket-actions";
import { TicketThread } from "@/components/support/ticket-thread";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getUserTicket } from "@/lib/services/support";

type TicketPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Support");
  return { title: t("title") };
}

export default async function TicketPage({ params }: TicketPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = await getUserTicket(id, user.id);
  if (!ticket) {
    notFound(); // no such ticket, or someone else's
  }
  const t = await getTranslations("Support");
  const locale = await getLocale();
  const isClosed = ticket.status === "CLOSED";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/support">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <StatusBadge status={ticket.status} />
        </div>
        {ticket.booking && (
          <p className="text-muted-foreground">{t("aboutBooking", { code: localizeDigits(ticket.booking.code, locale) })}</p>
        )}
        <p className="text-sm text-muted-foreground">{t(`statusHint.${ticket.status}`)}</p>
      </div>

      <Card>
        <CardContent>
          <TicketThread messages={ticket.messages} readerId={user.id} readerIsAdmin={false} />
        </CardContent>
      </Card>

      {isClosed ? (
        <p className="rounded-lg bg-muted p-3 text-sm">{t("closedNote")}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("writeTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TicketReplyForm ticketId={ticket.id} side="user" />
            <div className="border-t pt-4">
              <CloseTicketButton ticketId={ticket.id} side="user" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
