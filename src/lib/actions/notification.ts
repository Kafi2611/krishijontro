"use server";
// Server actions for the "Messages" (notifications) page.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/services/notification";

/** Marks all of the logged-in user's messages as read, then refreshes the pages. */
export async function markAllReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  // Re-render every page so the number on the bell goes back to 0.
  revalidatePath("/", "layout");
}
