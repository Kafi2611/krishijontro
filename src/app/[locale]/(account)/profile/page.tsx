// The profile page: shows the logged-in user's details and the extra
// information of their role (land for farmers, approval for providers, ...).
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { getUserWithProfile } from "@/lib/services/user";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile");
  return { title: t("title") };
}

/** One "label: value" line of the profile card. */
function ProfileRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b py-3 last:border-b-0 sm:flex-row sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await getUserWithProfile(sessionUser.id);
  const t = await getTranslations("Profile");
  const tRoles = await getTranslations("Roles");
  const tStatus = await getTranslations("Status");
  const tProviderTypes = await getTranslations("ProviderTypes");
  const format = await getFormatter();
  const locale = await getLocale();

  if (!user) {
    return null; // cannot happen for a logged-in user, but keeps TypeScript happy
  }

  const notSet = t("notSet");
  const farmer = user.farmerProfile;
  const provider = user.providerProfile;
  const operator = user.operatorProfile;
  const technician = user.technicianProfile;
  const officer = user.officerProfile;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {user.name}
            <Badge variant="secondary">{tRoles(user.role)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <ProfileRow label={t("phone")}>{localizeDigits(user.phone, locale)}</ProfileRow>
            <ProfileRow label={t("status")}>
              <Badge variant={user.status === "ACTIVE" ? "default" : "destructive"}>
                {tStatus(user.status)}
              </Badge>
            </ProfileRow>
            <ProfileRow label={t("memberSince")}>
              {format.dateTime(user.createdAt, { dateStyle: "long" })}
            </ProfileRow>

            {farmer && (
              <>
                <ProfileRow label={t("land")}>
                  {t("landValue", { decimal: farmer.landDecimal })}
                </ProfileRow>
                <ProfileRow label={t("village")}>{farmer.village ?? notSet}</ProfileRow>
                <ProfileRow label={t("upazila")}>
                  {farmer.location
                    ? pickByLocale(farmer.location.name, farmer.location.nameBn, locale)
                    : notSet}
                </ProfileRow>
                <ProfileRow label={t("verification")}>
                  {tStatus(farmer.verificationStatus)}
                </ProfileRow>
              </>
            )}

            {provider && (
              <>
                <ProfileRow label={t("providerType")}>
                  {tProviderTypes(provider.providerType)}
                </ProfileRow>
                <ProfileRow label={t("businessName")}>{provider.businessName ?? notSet}</ProfileRow>
                <ProfileRow label={t("upazila")}>
                  {provider.location
                    ? pickByLocale(provider.location.name, provider.location.nameBn, locale)
                    : notSet}
                </ProfileRow>
                <ProfileRow label={t("approval")}>{tStatus(provider.approvalStatus)}</ProfileRow>
                <ProfileRow label={t("trustScore")}>{format.number(provider.trustScore)}</ProfileRow>
              </>
            )}

            {operator && (
              <>
                <ProfileRow label={t("employer")}>{operator.provider.name}</ProfileRow>
                <ProfileRow label={t("experience")}>
                  {t("experienceValue", { years: operator.experienceYears })}
                </ProfileRow>
                <ProfileRow label={t("approval")}>{tStatus(operator.approvalStatus)}</ProfileRow>
              </>
            )}

            {technician && (
              <>
                <ProfileRow label={t("skills")}>{technician.skills ?? notSet}</ProfileRow>
                <ProfileRow label={t("upazila")}>
                  {technician.location
                    ? pickByLocale(technician.location.name, technician.location.nameBn, locale)
                    : notSet}
                </ProfileRow>
              </>
            )}

            {officer && (
              <>
                <ProfileRow label={t("designation")}>{officer.designation ?? notSet}</ProfileRow>
                <ProfileRow label={t("upazila")}>
                  {pickByLocale(officer.upazila.name, officer.upazila.nameBn, locale)}
                </ProfileRow>
              </>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
