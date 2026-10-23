// The Provider dashboard: the first page a PROVIDER user sees after login.
// It shows the account's approval note, the bookings waiting for the provider (new requests,
// and accepted ones that need an operator), the money waiting to be sent to them, machine and
// operator counts (each box opens its page), and the list of provider features.
import { CircleCheck, Clock, Inbox, Tractor, UserRound, Users, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProviderApprovalNote } from "@/components/provider/provider-approval-note";
import { requireRole } from "@/lib/auth";
import { countProviderBookingsToHandle } from "@/lib/services/booking-queries";
import { countProviderMachines } from "@/lib/services/machine";
import { countProviderOperators } from "@/lib/services/operator";
import { getProviderWaitingTotal } from "@/lib/services/payout";
import { getProviderProfile } from "@/lib/services/provider";

export default async function ProviderDashboardPage() {
  const provider = await requireRole("PROVIDER");
  const [profile, machines, operatorCount, toHandle, waitingPayout] = await Promise.all([
    getProviderProfile(provider.id),
    countProviderMachines(provider.id),
    countProviderOperators(provider.id),
    countProviderBookingsToHandle(provider.id),
    getProviderWaitingTotal(provider.id),
  ]);
  const t = await getTranslations("ProviderDashboard");

  return (
    <RoleDashboard role="PROVIDER">
      {profile && <ProviderApprovalNote approvalStatus={profile.approvalStatus} />}
      {/* Bookings waiting for the provider: amber when there is something to do */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={t("requests")}
          value={toHandle.requests}
          icon={<Inbox className="size-5" aria-hidden />}
          href="/provider/bookings"
          highlight={toHandle.requests > 0}
        />
        <StatCard
          label={t("needOperator")}
          value={toHandle.needOperator}
          icon={<UserRound className="size-5" aria-hidden />}
          href="/provider/bookings"
          highlight={toHandle.needOperator > 0}
        />
      </div>
      <StatCard
        label={t("waitingPayout")}
        value={waitingPayout}
        icon={<Wallet className="size-5" aria-hidden />}
        href="/provider/earnings"
      />
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
