// The Farmer dashboard: the first page a FARMER user sees after login.
// Phase 1 shows a welcome and the list of upcoming features.
import { RoleDashboard } from "@/components/dashboard/role-dashboard";

export default function FarmerDashboardPage() {
  return <RoleDashboard role="FARMER" />;
}
