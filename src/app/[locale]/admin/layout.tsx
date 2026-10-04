// Layout for every page under /admin. Only ADMIN users may enter
// (proxy.ts checks first, requireRole checks again here on the server),
// and they see the Admin sidebar.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  return <DashboardShell role="ADMIN">{children}</DashboardShell>;
}
