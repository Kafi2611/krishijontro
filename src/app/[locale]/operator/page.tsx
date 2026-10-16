// The Operator dashboard: the first page an OPERATOR user sees after login.
// It shows the jobs to do now (today's jobs, and late ones) with a link to all jobs,
// and the list of operator features.
import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { OperatorJobList } from "@/components/operator/job-list";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { listOperatorJobs } from "@/lib/services/booking-queries";

export default async function OperatorDashboardPage() {
  const operator = await requireRole("OPERATOR");
  const { now } = await listOperatorJobs(operator.id);
  const t = await getTranslations("OperatorDashboard");

  return (
    <RoleDashboard role="OPERATOR">
      <OperatorJobList
        emptyIcon={<ClipboardList className="size-12 text-muted-foreground" aria-hidden />}
        emptyText={t("nothingNow")}
        sections={[{ key: "now", title: t("todayTitle"), jobs: now }]}
      />
      <Button asChild variant="outline">
        <Link href="/operator/jobs">{t("seeAll")}</Link>
      </Button>
    </RoleDashboard>
  );
}
