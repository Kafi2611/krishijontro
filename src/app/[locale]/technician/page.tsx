// The Technician dashboard: the first page a TECHNICIAN user sees after login.
// It shows how many new requests wait for a technician, the technician's own open jobs and how
// many they fixed (each box opens the requests list), and the list of technician features.
import { CircleCheckBig, Inbox, Wrench } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { countTechnicianWork } from "@/lib/services/maintenance";

export default async function TechnicianDashboardPage() {
  const technician = await requireRole("TECHNICIAN");
  const counts = await countTechnicianWork(technician.id);
  const t = await getTranslations("Technician");

  return (
    <RoleDashboard role="TECHNICIAN">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("dashboardNew")}
          value={counts.newRequests}
          icon={<Inbox className="size-5" aria-hidden />}
          href="/technician/requests"
          highlight={counts.newRequests > 0}
        />
        <StatCard
          label={t("dashboardMine")}
          value={counts.myOpen}
          icon={<Wrench className="size-5" aria-hidden />}
          href="/technician/requests"
        />
        <StatCard
          label={t("dashboardFixed")}
          value={counts.fixed}
          icon={<CircleCheckBig className="size-5" aria-hidden />}
          href="/technician/requests"
        />
      </div>
      <Button asChild variant="outline">
        <Link href="/technician/requests">{t("seeAll")}</Link>
      </Button>
    </RoleDashboard>
  );
}
