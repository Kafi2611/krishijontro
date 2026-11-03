// The conversation of a support ticket, like a chat: the reader's own messages on the right
// (green), the other side's on the left (grey), each with who wrote it and when.
// To a user, every admin is shown as "KrishiJontro support".
import { useFormatter, useTranslations } from "next-intl";
import type { Role } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type ThreadMessage = {
  id: string;
  body: string;
  createdAt: Date;
  sender: { id: string; name: string; role: Role };
};

type TicketThreadProps = {
  messages: ThreadMessage[]; // oldest first
  readerId: string; // the person looking at the page
  readerIsAdmin: boolean;
};

export function TicketThread({ messages, readerId, readerIsAdmin }: TicketThreadProps) {
  const t = useTranslations("Support");
  const format = useFormatter();

  return (
    <ol className="space-y-3">
      {messages.map((message) => {
        const isMine = message.sender.id === readerId;
        // A user sees the team's name; an admin sees which admin wrote it.
        const senderName =
          message.sender.role === "ADMIN" && !readerIsAdmin ? t("supportTeam") : message.sender.name;
        return (
          <li key={message.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] space-y-1 rounded-2xl px-4 py-3",
                isMine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
              )}
            >
              <p className="text-sm font-semibold">{isMine ? t("you") : senderName}</p>
              {/* whitespace-pre-line keeps the line breaks the writer typed */}
              <p className="whitespace-pre-line">{message.body}</p>
              <time
                dateTime={message.createdAt.toISOString()}
                className={cn("block text-xs", isMine ? "text-primary-foreground/80" : "text-muted-foreground")}
              >
                {format.dateTime(message.createdAt, { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
