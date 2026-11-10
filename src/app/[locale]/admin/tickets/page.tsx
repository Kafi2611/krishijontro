// Admin page: support tickets (/admin/tickets?status=OPEN).
// Filter buttons by status (with how many tickets have it): "Waiting for us" (OPEN) is shown
// first, because those people wait for an answer. Each card opens the conversation.
import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FilterLinks, type FilterLink } from "@/components/list-filters";
import { PageHeader } from "@/components/page-header";
import { TicketCard } from "@/components/support/ticket-card";
import { Card, CardContent } from "@/components/ui/card";
import type { TicketStatus } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth";
import { getFormatter } from "@/lib/format-server";
import { listHref, readChoice } from "@/lib/list-params";
import { countTicketsByStatus, listTicketsForAdmin } from "@/lib/services/support";

type AdminTicketsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminTickets");
  return { title: t("title") };
}

export default async function AdminTicketsPage({ searchParams }: AdminTicketsPageProps) {
  await requireRole("ADMIN");
  const params = await searchParams;
  // With no choice in the address, the page starts with the tickets waiting for an answer.
  const status = params.status === "all" ? null : (readChoice(params.status, TICKET_STATUSES) ?? "OPEN");
  const [tickets, counts] = await Promise.all([listTicketsForAdmin(status), countTicketsByStatus()]);
  const t = await getTranslations("AdminTickets");
  const format = await getFormatter();

  const links: FilterLink[] = [
    ...TICKET_STATUSES.map((choice) => ({
      href: listHref("/admin/tickets", { status: choice }),
      label: `${t(`filters.${choice}`)} (${format.number(counts[choice] ?? 0)})`,
      active: status === choice,
    })),
    { href: listHref("/admin/tickets", { status: "all" }), label: t("filters.all"), active: status === null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <FilterLinks links={links} label={t("filterLabel")} />

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <LifeBuoy className="size-12 text-primary" aria-hidden />
            <p className="font-semibold">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <TicketCard href={`/admin/tickets/${ticket.id}`} ticket={ticket} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
