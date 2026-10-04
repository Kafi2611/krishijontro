// The "Messages" page: the user's notifications and simulated SMS, newest first.
import { MessageSquare, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { markAllReadAction } from "@/lib/actions/notification";
import { requireUser } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { listNotifications } from "@/lib/services/notification";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(user.id);
  const t = await getTranslations("Notifications");
  const format = await getFormatter();
  const locale = await getLocale();

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("unreadCount", { count: unreadCount })}</p>
        </div>
        {unreadCount > 0 && (
          // A plain HTML form that calls a server action: works even before JavaScript loads.
          <form action={markAllReadAction}>
            <Button type="submit" variant="outline">
              {t("markAllRead")}
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t("empty")}</CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {notifications.map((notification) => {
          const isSms = notification.channel === "SMS";
          const Icon = isSms ? Smartphone : MessageSquare;
          return (
            <li key={notification.id}>
              <Card className={notification.isRead ? "" : "border-primary/50 bg-accent/40"}>
                <CardContent className="flex gap-3">
                  <Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {pickByLocale(notification.title, notification.titleBn, locale)}
                      </p>
                      <Badge variant="outline">{isSms ? t("sms") : t("inApp")}</Badge>
                      {!notification.isRead && <Badge>{t("new")}</Badge>}
                    </div>
                    <p className="text-sm">
                      {pickByLocale(notification.body, notification.bodyBn, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(notification.createdAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
