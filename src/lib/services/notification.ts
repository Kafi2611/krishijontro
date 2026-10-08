/**
 * Notification service — the bell icon and the "Messages" page.
 *
 * Notifications are saved in the Notification table. SMS is simulated:
 * an "SMS" is just a Notification with channel = SMS, shown in the same list.
 * Every message is saved in English AND Bangla, so it can be shown in either language.
 */
import type { NotificationChannel, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type NewNotification = {
  userId: string; // who receives it
  title: string;
  titleBn: string;
  body: string;
  bodyBn: string;
  link?: string; // page to open, e.g. "/provider/machines/abc"
  channel?: NotificationChannel; // "IN_APP" (default) or "SMS" (simulated)
};

/**
 * Sends (saves) one notification to a user.
 * Pass `tx` to save it inside the same database transaction as another change.
 */
export async function createNotification(
  notification: NewNotification,
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.notification.create({ data: notification });
}

/** How many notifications this user has not read yet (the number on the bell). */
export async function countUnreadNotifications(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, isRead: false } });
}

/** The user's latest notifications, newest first (at most 50). */
export async function listNotifications(userId: string) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Marks every notification of this user as read. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
