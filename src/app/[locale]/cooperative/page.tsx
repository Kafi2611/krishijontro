// The Cooperative dashboard: the first page a COOP_LEADER user sees after login.
// Without a cooperative yet, it asks the leader to make one. Otherwise it shows the cooperative
// (name, village, upazila, with "Edit"), how many members and group bookings it has (each box
// opens its page), and the list of cooperative features.
import { CalendarRange, MapPin, Pencil, UsersRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getLeaderCooperative } from "@/lib/services/cooperative";

export default async function CooperativeDashboardPage() {
  const leader = await requireRole("COOP_LEADER");
  const cooperative = await getLeaderCooperative(leader.id);
  const t = await getTranslations("Cooperative");
  const locale = await getLocale();

  if (!cooperative) {
    return (
      <RoleDashboard role="COOP_LEADER">
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{t("createTitle")}</CardTitle>
            <CardDescription>{t("createText")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/cooperative/setup">{t("createTitle")}</Link>
            </Button>
          </CardContent>
        </Card>
      </RoleDashboard>
    );
  }

  return (
    <RoleDashboard role="COOP_LEADER">
      <Card>
        <CardHeader>
          <CardTitle>{cooperative.name}</CardTitle>
          <CardDescription className="flex items-center gap-1">
            <MapPin className="size-4" aria-hidden />
            {cooperative.village}, {pickByLocale(cooperative.location.name, cooperative.location.nameBn, locale)}
            {cooperative.registrationNo && ` · ${localizeDigits(cooperative.registrationNo, locale)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/cooperative/setup">
              <Pencil aria-hidden />
              {t("edit")}
            </Link>
          </Button>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={t("statMembers")}
          value={cooperative._count.members}
          icon={<UsersRound className="size-5" aria-hidden />}
          href="/cooperative/members"
          highlight={cooperative._count.members < 2}
        />
        <StatCard
          label={t("statGroupBookings")}
          value={cooperative._count.groupBookings}
          icon={<CalendarRange className="size-5" aria-hidden />}
        />
      </div>
    </RoleDashboard>
  );
}
