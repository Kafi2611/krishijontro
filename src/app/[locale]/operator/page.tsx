// The Operator dashboard: the first page a OPERATOR user sees after login.
// Phase 1 shows a welcome and the list of upcoming features.
import { RoleDashboard } from "@/components/dashboard/role-dashboard";

export default function OperatorDashboardPage() {
  return <RoleDashboard role="OPERATOR" />;
}
