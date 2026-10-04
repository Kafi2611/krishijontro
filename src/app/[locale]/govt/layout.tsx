// Layout for every page under /govt. Only GOVT users may enter
// (proxy.ts checks first, requireRole checks again here on the server),
// and they see the Govt sidebar.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function GovtLayout({ children }: { children: React.ReactNode }) {
  await requireRole("GOVT");
  return <DashboardShell role="GOVT">{children}</DashboardShell>;
}
