// The Provider dashboard: the first page a PROVIDER user sees after login.
// It shows the account's approval note, machine and operator counts (each box
// opens its page), and the list of upcoming provider features.
import { CircleCheck, Clock, Tractor, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProviderApprovalNote } from "@/components/provider/provider-approval-note";
import { requireRole } from "@/lib/auth";
import { countProviderMachines } from "@/lib/services/machine";
import { countProviderOperators } from "@/lib/services/operator";
import { getProviderProfile } from "@/lib/services/provider";

export default async function ProviderDashboardPage() {
  const provider = await requireRole("PROVIDER");
  const [profile, machines, operatorCount] = await Promise.all([
    getProviderProfile(provider.id),
    countProviderMachines(provider.id),
    countProviderOperators(provider.id),
  ]);
  const t = await getTranslations("ProviderDashboard");

  return (
    <RoleDashboard role="PROVIDER">
      {profile && <ProviderApprovalNote approvalStatus={profile.approvalStatus} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("machines")}
          value={machines.total}
          icon={<Tractor className="size-5" aria-hidden />}
          href="/provider/machines"
        />
        <StatCard
          label={t("approved")}
          value={machines.approved}
          icon={<CircleCheck className="size-5" aria-hidden />}
          href="/provider/machines"
        />
        <StatCard
          label={t("waiting")}
          value={machines.pending}
          icon={<Clock className="size-5" aria-hidden />}
          href="/provider/machines"
          highlight={machines.pending > 0}
        />
        <StatCard
          label={t("operators")}
          value={operatorCount}
          icon={<Users className="size-5" aria-hidden />}
          href="/provider/operators"
        />
      </div>
    </RoleDashboard>
  );
}
