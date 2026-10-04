// The Govt dashboard: the first page a GOVT user sees after login.
// Phase 1 shows a welcome and the list of upcoming features.
import { RoleDashboard } from "@/components/dashboard/role-dashboard";

export default function GovtDashboardPage() {
  return <RoleDashboard role="GOVT" />;
}
