/**
 * Notification service — the bell icon and the "Messages" page.
 *
 * Notifications are saved in the Notification table. SMS is simulated:
 * an "SMS" is just a Notification with channel = SMS, shown in the same list.
 * (Phase 4 adds the function that CREATES notifications when bookings change.)
 */
import { db } from "@/lib/db";

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
