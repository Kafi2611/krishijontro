// Layout for every page under /officer. Only OFFICER users may enter
// (proxy.ts checks first, requireRole checks again here on the server),
// and they see the Officer sidebar.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function OfficerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("OFFICER");
  return <DashboardShell role="OFFICER">{children}</DashboardShell>;
}
