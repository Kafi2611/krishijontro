// Provider page: "Business details" — the details the admin checks before
// approving this provider, and the current approval status.
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BusinessForm } from "@/components/provider/business-form";
import { ProviderApprovalNote } from "@/components/provider/provider-approval-note";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listUpazilaOptions } from "@/lib/services/location";
import { getProviderProfile } from "@/lib/services/provider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Business");
  return { title: t("title") };
}

export default async function BusinessPage() {
  const provider = await requireRole("PROVIDER");
  const [profile, upazilas] = await Promise.all([
    getProviderProfile(provider.id),
    listUpazilaOptions(),
  ]);
  const t = await getTranslations("Business");

  if (!profile) {
    return null; // every PROVIDER user gets a profile when registering
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <span className="flex items-center gap-2 text-sm">
            {t("approval")} <StatusBadge status={profile.approvalStatus} />
          </span>
        }
      />
      <ProviderApprovalNote approvalStatus={profile.approvalStatus} />
      <Card>
        <CardContent>
          <BusinessForm
            upazilas={upazilas}
            defaultValues={{
              providerType: profile.providerType,
              businessName: profile.businessName ?? "",
              nid: profile.nid ?? "",
              tradeLicenseNo: profile.tradeLicenseNo ?? "",
              address: profile.address ?? "",
              locationId: profile.locationId ?? "",
              payoutAccount: profile.payoutAccount ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
