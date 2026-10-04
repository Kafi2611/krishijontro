// The bell icon in the navbar. Shows how many messages are unread and opens the Messages page.
import { Bell } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/navigation";

type NotificationBellProps = {
  unreadCount: number;
};

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  const t = useTranslations("Notifications");
  const format = useFormatter(); // shows ৩ instead of 3 in Bangla

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href="/notifications" aria-label={t("unreadCount", { count: unreadCount })}>
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-white">
            {format.number(unreadCount)}
          </span>
        )}
      </Link>
    </Button>
  );
}
