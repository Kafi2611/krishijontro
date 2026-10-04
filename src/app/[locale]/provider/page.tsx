// The Provider dashboard: the first page a PROVIDER user sees after login.
// Phase 1 shows a welcome and the list of upcoming features.
import { RoleDashboard } from "@/components/dashboard/role-dashboard";

export default function ProviderDashboardPage() {
  return <RoleDashboard role="PROVIDER" />;
}
