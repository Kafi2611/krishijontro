// Officer page: verify farmers (/officer/farmers).
// The farmers of the officer's upazila who sent their NID and land and wait for a check (oldest
// first), each with Verify / Reject. Below, the farmers checked most recently.
// An officer never sees farmers of another upazila (lib/services/verification.ts).
import { CircleCheckBig, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { DetailRow } from "@/components/detail-row";
import { OfficerDecision } from "@/components/officer/officer-decision";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { decimalToBigha } from "@/lib/services/geo";
import { listFarmersForOfficer } from "@/lib/services/verification";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OfficerFarmers");
  return { title: t("title") };
}

export default async function OfficerFarmersPage() {
  const officer = await requireRole("OFFICER");
  const data = await listFarmersForOfficer(officer.id);
  const t = await getTranslations("OfficerFarmers");
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
          {data.waiting.map((farmer) => (
            <li key={farmer.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{farmer.user.name}</CardTitle>
                  <a href={`tel:${farmer.user.phone}`} className="inline-flex items-center gap-1 text-sm text-primary">
                    <Phone className="size-4" aria-hidden />
                    {localizeDigits(farmer.user.phone, locale)}
                  </a>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl>
                    <DetailRow label={t("nid")}>{localizeDigits(farmer.nid ?? "", locale)}</DetailRow>
                    <DetailRow label={t("land")}>
                      {t("landValue", { decimal: farmer.landDecimal, bigha: Math.round(decimalToBigha(farmer.landDecimal) * 10) / 10 })}
                    </DetailRow>
                    <DetailRow label={t("village")}>{farmer.village ?? "—"}</DetailRow>
                    <DetailRow label={t("sentOn")}>{format.dateTime(farmer.updatedAt, { dateStyle: "medium" })}</DetailRow>
                  </dl>
                  <OfficerDecision kind="farmer" id={farmer.userId} canApprove />
                </CardContent>
              </Card>
            </li>
          ))}
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
            {data.recent.map((farmer) => (
              <li key={farmer.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{farmer.user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {farmer.verifiedAt ? format.dateTime(farmer.verifiedAt, { dateStyle: "medium" }) : "—"}
                    {farmer.rejectionReason && ` · ${farmer.rejectionReason}`}
                  </p>
                </div>
                <StatusBadge status={farmer.verificationStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
