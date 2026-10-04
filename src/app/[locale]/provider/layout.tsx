// Layout for every page under /provider. Only PROVIDER users may enter
// (proxy.ts checks first, requireRole checks again here on the server),
// and they see the Provider sidebar.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  await requireRole("PROVIDER");
  return <DashboardShell role="PROVIDER">{children}</DashboardShell>;
}
