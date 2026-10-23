// Farmer page: government subsidy (/farmer/subsidy), in two steps.
//   Step 1: the farmer's NID and land, checked by the agriculture officer of their upazila
//           (the form, or the details read-only once they are verified).
//   Step 2: the open programs, each with the farmer's application status or an Apply box.
// At the top, the discount the farmer gets right now (if any).
import { BadgePercent, IdCard, Info } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { DetailRow } from "@/components/detail-row";
import { FarmerDetailsForm } from "@/components/farmer/farmer-details-form";
import { SubsidyApplyForm } from "@/components/farmer/subsidy-apply-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { listUpazilaOptions } from "@/lib/services/location";
import { findUsableSubsidy, listProgramsForFarmer } from "@/lib/services/subsidy";
import { getFarmerDetails } from "@/lib/services/verification";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FarmerSubsidy");
  return { title: t("title") };
}

export default async function FarmerSubsidyPage() {
  const farmer = await requireRole("FARMER");
  const [profile, programs, usable, upazilas] = await Promise.all([
    getFarmerDetails(farmer.id),
    listProgramsForFarmer(farmer.id),
    findUsableSubsidy(farmer.id),
    listUpazilaOptions(),
  ]);
  const t = await getTranslations("FarmerSubsidy");
  const tError = await getTranslations("Validation");
  const format = await getFormatter();
  const locale = await getLocale();

  const detailsSent = Boolean(profile?.nid); // the farmer has filled in step 1 at least once
  const isVerified = profile?.verificationStatus === "VERIFIED";

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {usable && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="flex items-center gap-3">
            <BadgePercent className="size-8 shrink-0 text-green-700" aria-hidden />
            <p>
              {t("activeText", {
                percent: usable.discountPercent,
                program: pickByLocale(usable.programName, usable.programNameBn, locale),
              })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: NID and land ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <IdCard className="size-5 text-primary" aria-hidden />
            {t("step1")}
            {detailsSent && profile && <StatusBadge status={profile.verificationStatus} />}
          </CardTitle>
          <CardDescription>{t("step1Text")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!detailsSent && <p className="rounded-lg bg-muted p-3 text-sm">{t("notSent")}</p>}
          {detailsSent && profile?.verificationStatus === "PENDING" && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{t("waitingText")}</p>
          )}
          {profile?.verificationStatus === "REJECTED" && detailsSent && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
              {t("rejectedText", { reason: profile.rejectionReason ?? "—" })}
            </p>
          )}

          {isVerified && profile ? (
            <>
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">{t("verifiedText")}</p>
              <dl>
                <DetailRow label={t("nid")}>{localizeDigits(profile.nid ?? "", locale)}</DetailRow>
                <DetailRow label={t("land")}>{t("landValue", { decimal: profile.landDecimal })}</DetailRow>
                <DetailRow label={t("village")}>{profile.village ?? "—"}</DetailRow>
                <DetailRow label={t("upazila")}>
                  {profile.location ? pickByLocale(profile.location.name, profile.location.nameBn, locale) : "—"}
                </DetailRow>
              </dl>
            </>
          ) : (
            <FarmerDetailsForm
              upazilas={upazilas}
              defaultValues={{
                nid: profile?.nid ?? "",
                landValue: profile?.landDecimal ? profile.landDecimal : undefined,
                landUnit: "DECIMAL",
                village: profile?.village ?? "",
                locationId: profile?.locationId ?? "",
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: programs ── */}
      <section className="space-y-3" aria-labelledby="programs-title">
        <h2 id="programs-title" className="text-xl font-bold">
          {t("step2")}
        </h2>
        {programs.length === 0 && <p className="text-muted-foreground">{t("noPrograms")}</p>}
        <ul className="grid gap-4 lg:grid-cols-2">
          {programs.map(({ program, application, problem }) => {
            // The farmer may apply when nothing stops them and they have no live application.
            const canApply = !problem && (!application || application.status === "REJECTED");
            return (
              <li key={program.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {pickByLocale(program.name, program.nameBn, locale)}
                      {application && <StatusBadge status={application.status} />}
                    </CardTitle>
                    {program.description && <CardDescription>{program.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl>
                      <DetailRow label={t("discountLabel")}>{t("discount", { percent: program.discountPercent })}</DetailRow>
                      <DetailRow label={t("whoLabel")}>
                        {program.maxLandDecimal !== null ? t("maxLand", { decimal: program.maxLandDecimal }) : t("anyLand")}
                      </DetailRow>
                      <DetailRow label={t("untilLabel")}>{format.dateTime(program.endAt, { dateStyle: "medium" })}</DetailRow>
                      <DetailRow label={t("budgetLeftLabel")}>
                        {t("budgetLeft", { amount: Math.max(0, program.budget - program.usedAmount) })}
                      </DetailRow>
                    </dl>

                    {application?.status === "PENDING" && <p className="text-sm text-muted-foreground">{t("pendingText")}</p>}
                    {application?.status === "APPROVED" && (
                      <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">{t("approvedText")}</p>
                    )}
                    {application?.status === "REJECTED" && (
                      <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
                        {t("rejectedAppText", { reason: application.rejectionReason ?? "—" })}
                      </p>
                    )}

                    {canApply && <SubsidyApplyForm programId={program.id} applyAgain={application !== null} />}
                    {problem && (!application || application.status === "REJECTED") && (
                      <p className="flex gap-2 rounded-lg bg-muted p-3 text-sm">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {tError(problem)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
