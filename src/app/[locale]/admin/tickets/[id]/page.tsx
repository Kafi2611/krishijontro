// Admin page: one support ticket (/admin/tickets/<id>): who opened it (with a call button), the
// booking it is about (a link to the admin's booking page), the conversation, the answer box and
// "Close". Answering moves the ticket to "Being answered" and tells the user.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ContactLine } from "@/components/booking/contact-line";
import { StatusBadge } from "@/components/status-badge";
import { CloseTicketButton, TicketReplyForm } from "@/components/support/ticket-actions";
import { TicketThread } from "@/components/support/ticket-thread";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getTicketForAdmin } from "@/lib/services/support";

type AdminTicketPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminTickets");
  return { title: t("title") };
}

export default async function AdminTicketPage({ params }: AdminTicketPageProps) {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const ticket = await getTicketForAdmin(id);
  if (!ticket) {
    notFound();
  }
  const t = await getTranslations("AdminTickets");
  const tSupport = await getTranslations("Support");
  const tRoles = await getTranslations("Roles");
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/admin/tickets">
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
          <Link href={`/admin/bookings/${ticket.booking.id}`} className="text-primary underline-offset-4 hover:underline">
            {tSupport("aboutBooking", { code: localizeDigits(ticket.booking.code, locale) })}
          </Link>
        )}
      </div>

      <Card>
        <CardContent>
          <ContactLine label={tRoles(ticket.user.role)} name={ticket.user.name} phone={ticket.user.phone} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <TicketThread messages={ticket.messages} readerId={admin.id} readerIsAdmin />
        </CardContent>
      </Card>

      {ticket.status === "CLOSED" ? (
        <p className="rounded-lg bg-muted p-3 text-sm">{t("closedNote")}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("answerTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TicketReplyForm ticketId={ticket.id} side="admin" />
            <div className="border-t pt-4">
              <CloseTicketButton ticketId={ticket.id} side="admin" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
