// Officer page: subsidy applications (/officer/subsidies).
// The applications of farmers of the officer's upazila that wait for a decision (oldest first).
// Each shows the program, the farmer's land and check status, and Approve / Reject. When the
// farmer cannot be approved yet (e.g. not verified), a note says why and only Reject is shown.
// Below, the applications decided most recently.
import { CircleAlert, CircleCheckBig, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { DetailRow } from "@/components/detail-row";
import { OfficerDecision } from "@/components/officer/officer-decision";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { listApplicationsForOfficer } from "@/lib/services/subsidy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OfficerSubsidies");
  return { title: t("title") };
}

export default async function OfficerSubsidiesPage() {
  const officer = await requireRole("OFFICER");
  const data = await listApplicationsForOfficer(officer.id);
  const t = await getTranslations("OfficerSubsidies");
  const tError = await getTranslations("Validation");
  const format = await getFormatter();
  const locale = await getLocale();

  if (!data) {
    return <PageHeader title={t("title")} description={t("noUpazila")} />;
  }
  const upazilaName = pickByLocale(data.upazila.name, data.upazila.nameBn, locale);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle", { upazila: upazilaName })} />

      {data.waiting.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CircleCheckBig className="size-12 text-primary" aria-hidden />
            <p className="font-semibold">{t("waitingEmpty")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.waiting.map((application) => {
            const profile = application.farmer.farmerProfile;
            const { program } = application;
            return (
              <li key={application.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>{application.farmer.name}</CardTitle>
                    <a href={`tel:${application.farmer.phone}`} className="inline-flex items-center gap-1 text-sm text-primary">
                      <Phone className="size-4" aria-hidden />
                      {localizeDigits(application.farmer.phone, locale)}
                    </a>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl>
                      <DetailRow label={t("program")}>{pickByLocale(program.name, program.nameBn, locale)}</DetailRow>
                      <DetailRow label={t("rule")}>
                        {program.maxLandDecimal !== null
                          ? t("ruleValue", { percent: program.discountPercent, decimal: program.maxLandDecimal })
                          : t("ruleAnyLand", { percent: program.discountPercent })}
                      </DetailRow>
                      <DetailRow label={t("land")}>{t("landValue", { decimal: profile?.landDecimal ?? 0 })}</DetailRow>
                      <DetailRow label={t("check")}>
                        {profile ? <StatusBadge status={profile.verificationStatus} /> : "—"}
                      </DetailRow>
                      <DetailRow label={t("appliedOn")}>{format.dateTime(application.createdAt, { dateStyle: "medium" })}</DetailRow>
                    </dl>
                    {application.note && (
                      <p className="rounded-lg bg-muted p-3 text-sm">
                        <span className="font-medium">{t("note")}: </span>
                        {application.note}
                      </p>
                    )}
                    {application.problem && (
                      <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {tError(application.problem)}
                      </p>
                    )}
                    <OfficerDecision kind="subsidy" id={application.id} canApprove={application.problem === null} />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <section className="space-y-3" aria-labelledby="recent-title">
        <h2 id="recent-title" className="text-xl font-bold">
          {t("recentTitle")}
        </h2>
        {data.recent.length === 0 ? (
          <p className="text-muted-foreground">{t("recentEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {data.recent.map((application) => (
              <li key={application.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{application.farmer.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {pickByLocale(application.program.name, application.program.nameBn, locale)}
                    {application.rejectionReason && ` · ${application.rejectionReason}`}
                  </p>
                </div>
                <StatusBadge status={application.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
