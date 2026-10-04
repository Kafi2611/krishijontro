// /dashboard is a shortcut: it sends each user to their own role's dashboard
// (a farmer goes to /farmer, an admin to /admin...). Login redirects here.
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { getHomePathForRole } from "@/lib/roles";

export default async function DashboardPage() {
  const user = await requireUser();
  const locale = await getLocale();
  redirect({ href: getHomePathForRole(user.role), locale });
}
