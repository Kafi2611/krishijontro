// Layout for pages every logged-in user has (profile, messages).
// It shows the sidebar of the user's OWN role.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireUser } from "@/lib/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <DashboardShell role={user.role}>{children}</DashboardShell>;
}
