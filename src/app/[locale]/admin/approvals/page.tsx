// Admin page: approvals (/admin/approvals?tab=providers|machines|operators).
// Three tabs, each a list of items waiting for the admin's decision.
// The tabs are plain links that change ?tab=..., so the page works without JavaScript.
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { PendingMachines, PendingOperators, PendingProviders } from "@/components/admin/approval-lists";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { countPendingApprovals } from "@/lib/services/approval";
import { cn } from "@/lib/utils";
import { APPROVAL_TARGETS, type ApprovalTarget } from "@/lib/validators/approval";

type ApprovalsPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Approvals");
  return { title: t("title") };
}

/** Turns ?tab=... into one of our three tabs (providers if missing or unknown). */
function pickTab(tab: string | undefined): ApprovalTarget {
  const found = APPROVAL_TARGETS.find((target) => target === tab);
  return found ?? "providers";
}

export default async function ApprovalsPage({ searchParams }: ApprovalsPageProps) {
  await requireRole("ADMIN");
  const activeTab = pickTab((await searchParams).tab);
  const counts = await countPendingApprovals();
  const t = await getTranslations("Approvals");
  const format = await getFormatter();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <nav className="grid grid-cols-3 gap-2" aria-label={t("title")}>
        {APPROVAL_TARGETS.map((target) => (
          <Link
            key={target}
            href={`/admin/approvals?tab=${target}`}
            aria-current={target === activeTab ? "page" : undefined}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-medium transition-colors sm:text-base",
              target === activeTab ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {t(`tabs.${target}`)}
            <span
              className={cn(
                "rounded-full px-2 text-sm",
                target === activeTab ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {format.number(counts[target])}
            </span>
          </Link>
        ))}
      </nav>

      {activeTab === "providers" && <PendingProviders />}
      {activeTab === "machines" && <PendingMachines />}
      {activeTab === "operators" && <PendingOperators />}
    </div>
  );
}
