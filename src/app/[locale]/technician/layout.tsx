// Layout for every page under /technician. Only TECHNICIAN users may enter
// (proxy.ts checks first, requireRole checks again here on the server),
// and they see the Technician sidebar.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  await requireRole("TECHNICIAN");
  return <DashboardShell role="TECHNICIAN">{children}</DashboardShell>;
}
