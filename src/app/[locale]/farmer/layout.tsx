// Layout for every page under /farmer. Only FARMER users may enter
// (proxy.ts checks first, requireRole checks again here on the server),
// and they see the Farmer sidebar.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function FarmerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("FARMER");
  return <DashboardShell role="FARMER">{children}</DashboardShell>;
}
