// The Officer dashboard: the first page a OFFICER user sees after login.
// Phase 1 shows a welcome and the list of upcoming features.
import { RoleDashboard } from "@/components/dashboard/role-dashboard";

export default function OfficerDashboardPage() {
  return <RoleDashboard role="OFFICER" />;
}
