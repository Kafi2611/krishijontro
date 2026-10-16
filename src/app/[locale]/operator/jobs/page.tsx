// Operator page: "My jobs" (/operator/jobs). The jobs the provider sent this operator:
// what to do now (today's jobs, and late ones), what is coming up, and what is done.
import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OperatorJobList } from "@/components/operator/job-list";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { listOperatorJobs } from "@/lib/services/booking-queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OperatorJobs");
  return { title: t("title") };
}

export default async function OperatorJobsPage() {
  const operator = await requireRole("OPERATOR");
  const groups = await listOperatorJobs(operator.id);
  const t = await getTranslations("OperatorJobs");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <OperatorJobList
        emptyIcon={<ClipboardList className="size-12 text-muted-foreground" aria-hidden />}
        sections={[
          { key: "now", title: t("now"), jobs: groups.now },
          { key: "coming", title: t("coming"), jobs: groups.coming },
          { key: "done", title: t("done"), jobs: groups.done },
        ]}
      />
    </div>
  );
}
