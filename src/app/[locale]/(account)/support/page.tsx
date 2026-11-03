// The "Help" page (/support) for every logged-in user: their own support tickets, the latest
// activity first, and "Ask for help" to open a new one. Each card opens the conversation.
import { LifeBuoy, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { TicketCard } from "@/components/support/ticket-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { listUserTickets } from "@/lib/services/support";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Support");
  return { title: t("title") };
}

export default async function SupportPage() {
  const user = await requireUser();
  const tickets = await listUserTickets(user.id);
  const t = await getTranslations("Support");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild size="lg">
            <Link href="/support/new">
              <Plus aria-hidden />
              {t("newTicket")}
            </Link>
          </Button>
        }
      />

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <LifeBuoy className="size-12 text-primary" aria-hidden />
            <p className="font-semibold">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <TicketCard href={`/support/${ticket.id}`} ticket={ticket} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
