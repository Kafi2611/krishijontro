// Admin page: payments (/admin/payments?tab=payments|payouts).
// Two tabs: the latest payments of all farmers (with refunds), and the payouts to providers.
// The tabs are plain links that change ?tab=..., like the approvals page.
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PayoutLists, RecentPayments } from "@/components/admin/payment-lists";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const TABS = ["payments", "payouts"] as const;
type PaymentsTab = (typeof TABS)[number];

type AdminPaymentsPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminPayments");
  return { title: t("title") };
}

/** Turns ?tab=... into one of our two tabs (payments if missing or unknown). */
function pickTab(tab: string | undefined): PaymentsTab {
  return tab === "payouts" ? "payouts" : "payments";
}

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  await requireRole("ADMIN");
  const activeTab = pickTab((await searchParams).tab);
  const t = await getTranslations("AdminPayments");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <nav className="grid grid-cols-2 gap-2" aria-label={t("title")}>
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/admin/payments?tab=${tab}`}
            aria-current={tab === activeTab ? "page" : undefined}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border px-2 font-medium transition-colors",
              tab === activeTab ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {t(`tabs.${tab}`)}
          </Link>
        ))}
      </nav>

      {activeTab === "payments" ? <RecentPayments /> : <PayoutLists />}
    </div>
  );
}
