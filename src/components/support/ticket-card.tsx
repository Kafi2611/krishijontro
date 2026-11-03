// A card for one support ticket in a list: the subject, the status, the booking it is about,
// how many messages it has and when it last changed. For the admin also who opened it.
// The whole card is a link to the ticket's conversation.
import { MessagesSquare } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Role, TicketStatus } from "@/generated/prisma/enums";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

type TicketCardProps = {
  href: string;
  ticket: {
    subject: string;
    status: TicketStatus;
    updatedAt: Date;
    booking: { code: string } | null;
    _count: { messages: number };
    user?: { name: string; role: Role }; // only on the admin's list
  };
};

export function TicketCard({ href, ticket }: TicketCardProps) {
  const t = useTranslations("Support");
  const tRoles = useTranslations("Roles");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <Link href={href} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
            <MessagesSquare className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{ticket.subject}</p>
              <StatusBadge status={ticket.status} />
            </div>
            {ticket.user && (
              <p className="text-sm">
                {ticket.user.name} · {tRoles(ticket.user.role)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {ticket.booking && `${localizeDigits(ticket.booking.code, locale)} · `}
              {t("messageCount", { count: ticket._count.messages })} ·{" "}
              {format.dateTime(ticket.updatedAt, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
