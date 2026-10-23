// The Admin dashboard: the first page an ADMIN user sees after login.
// It shows how many providers, machines and operators wait for approval, and how many
// providers wait for their money (each box opens that list), and the list of admin features.
import { Building2, Tractor, Users, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireRole } from "@/lib/auth";
import { countPendingApprovals } from "@/lib/services/approval";
import { countProvidersToPay } from "@/lib/services/payout";

export default async function AdminDashboardPage() {
  await requireRole("ADMIN");
  const [pending, providersToPay] = await Promise.all([countPendingApprovals(), countProvidersToPay()]);
  const t = await getTranslations("AdminDashboard");

  return (
    <RoleDashboard role="ADMIN">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("waitingTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label={t("providersWaiting")}
            value={pending.providers}
            icon={<Building2 className="size-5" aria-hidden />}
            href="/admin/approvals?tab=providers"
            highlight={pending.providers > 0}
          />
          <StatCard
            label={t("machinesWaiting")}
            value={pending.machines}
            icon={<Tractor className="size-5" aria-hidden />}
            href="/admin/approvals?tab=machines"
            highlight={pending.machines > 0}
          />
          <StatCard
            label={t("operatorsWaiting")}
            value={pending.operators}
            icon={<Users className="size-5" aria-hidden />}
            href="/admin/approvals?tab=operators"
            highlight={pending.operators > 0}
          />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("moneyTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label={t("providersToPay")}
            value={providersToPay}
            icon={<Wallet className="size-5" aria-hidden />}
            href="/admin/payments?tab=payouts"
            highlight={providersToPay > 0}
          />
        </div>
      </section>
    </RoleDashboard>
  );
}
