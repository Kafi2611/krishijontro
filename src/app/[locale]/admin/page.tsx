// The Admin dashboard: the first page a ADMIN user sees after login.
// Phase 1 shows a welcome and the list of upcoming features.
import { RoleDashboard } from "@/components/dashboard/role-dashboard";

export default function AdminDashboardPage() {
  return <RoleDashboard role="ADMIN" />;
}
