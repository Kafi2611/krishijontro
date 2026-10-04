// Layout for every page under /cooperative. Only COOP_LEADER users may enter
// (proxy.ts checks first, requireRole checks again here on the server),
// and they see the Cooperative sidebar.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function CooperativeLayout({ children }: { children: React.ReactNode }) {
  await requireRole("COOP_LEADER");
  return <DashboardShell role="COOP_LEADER">{children}</DashboardShell>;
}
