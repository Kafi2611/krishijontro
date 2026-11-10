// Cooperative leader page: the members (/cooperative/members).
// The add form (by mobile number) and one card per member farmer: name, phone, land, village,
// whether an officer verified them, and a Remove button. Without a cooperative yet, it asks
// the leader to make one first.
import { Phone, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AddMemberForm, RemoveMemberButton } from "@/components/cooperative/member-actions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getFormatter } from "@/lib/format-server";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getLeaderCooperative, listMembers } from "@/lib/services/cooperative";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Cooperative");
  return { title: t("membersTitle") };
}

export default async function CooperativeMembersPage() {
  const leader = await requireRole("COOP_LEADER");
  const [cooperative, members] = await Promise.all([getLeaderCooperative(leader.id), listMembers(leader.id)]);
  const t = await getTranslations("Cooperative");
  const format = await getFormatter();
  const locale = await getLocale();

  if (!cooperative) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("membersTitle")} />
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p>{t("createFirst")}</p>
            <Button asChild size="lg">
              <Link href="/cooperative/setup">{t("createTitle")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("membersTitle")} description={t("membersSubtitle", { name: cooperative.name })} />

      <Card>
        <CardHeader>
          <CardTitle>{t("addMemberTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AddMemberForm />
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{t("memberCount", { count: members.length })}</p>
      {members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <UsersRound className="size-12 text-primary" aria-hidden />
            <p className="font-semibold">{t("noMembers")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map((member) => {
            const profile = member.farmer.farmerProfile;
            return (
              <li key={member.id}>
                <Card className="h-full">
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{member.farmer.name}</p>
                      {profile && <StatusBadge status={profile.verificationStatus} />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("memberFacts", {
                        land: format.number(profile?.landDecimal ?? 0),
                        village: profile?.village ?? "—",
                      })}
                    </p>
                    {member.farmer.status === "SUSPENDED" && (
                      <p className="text-sm text-destructive">{t("memberSuspended")}</p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={`tel:${member.farmer.phone}`}>
                          <Phone aria-hidden />
                          {localizeDigits(member.farmer.phone, locale)}
                        </a>
                      </Button>
                      <RemoveMemberButton memberId={member.id} name={member.farmer.name} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
