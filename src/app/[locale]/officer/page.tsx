// The Officer dashboard: the first page an OFFICER user sees after login.
// It shows how many farmers of the officer's upazila wait to be verified, how many subsidy
// applications wait for a decision and how many complaints about jobs there are open (each box
// opens that page), and the list of officer features.
import { FileCheck, MessageSquareWarning, UserCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireRole } from "@/lib/auth";
import { countUpazilaOpenComplaints } from "@/lib/services/officer";
import { countApplicationsToDecide } from "@/lib/services/subsidy";
import { countFarmersToVerify } from "@/lib/services/verification";

export default async function OfficerDashboardPage() {
  const officer = await requireRole("OFFICER");
  const [farmersToVerify, applicationsWaiting, openComplaints] = await Promise.all([
    countFarmersToVerify(officer.id),
    countApplicationsToDecide(officer.id),
    countUpazilaOpenComplaints(officer.id),
  ]);
  const t = await getTranslations("OfficerDashboard");

  return (
    <RoleDashboard role="OFFICER">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("farmersToVerify")}
          value={farmersToVerify}
          icon={<UserCheck className="size-5" aria-hidden />}
          href="/officer/farmers"
          highlight={farmersToVerify > 0}
        />
        <StatCard
          label={t("applicationsWaiting")}
          value={applicationsWaiting}
          icon={<FileCheck className="size-5" aria-hidden />}
          href="/officer/subsidies"
          highlight={applicationsWaiting > 0}
        />
        <StatCard
          label={t("openComplaints")}
          value={openComplaints}
          icon={<MessageSquareWarning className="size-5" aria-hidden />}
          href="/officer/bookings"
          highlight={openComplaints > 0}
        />
      </div>
    </RoleDashboard>
  );
}
