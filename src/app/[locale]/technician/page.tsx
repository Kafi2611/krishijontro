// The Technician dashboard: the first page a TECHNICIAN user sees after login.
// Phase 1 shows a welcome and the list of upcoming features.
import { RoleDashboard } from "@/components/dashboard/role-dashboard";

export default function TechnicianDashboardPage() {
  return <RoleDashboard role="TECHNICIAN" />;
}
