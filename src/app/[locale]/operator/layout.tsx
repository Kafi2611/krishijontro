// Layout for every page under /operator. Only OPERATOR users may enter
// (proxy.ts checks first, requireRole checks again here on the server),
// and they see the Operator sidebar.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  await requireRole("OPERATOR");
  return <DashboardShell role="OPERATOR">{children}</DashboardShell>;
}
