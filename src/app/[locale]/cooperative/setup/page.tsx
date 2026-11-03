// Cooperative leader page: the cooperative's details (/cooperative/setup).
// The first time it makes the cooperative; later it changes its name, upazila, village or
// registration number.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CooperativeForm } from "@/components/cooperative/cooperative-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { getLeaderCooperative } from "@/lib/services/cooperative";
import { listUpazilaOptions } from "@/lib/services/location";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Cooperative");
  return { title: t("setupTitle") };
}

export default async function CooperativeSetupPage() {
  const leader = await requireRole("COOP_LEADER");
  const [cooperative, upazilas] = await Promise.all([getLeaderCooperative(leader.id), listUpazilaOptions()]);
  const t = await getTranslations("Cooperative");

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/cooperative">
          <ArrowLeft aria-hidden />
          {t("backToDashboard")}
        </Link>
      </Button>
      <PageHeader title={cooperative ? t("setupTitle") : t("createTitle")} description={t("setupSubtitle")} />
      <Card>
        <CardContent>
          <CooperativeForm
            upazilas={upazilas}
            defaultValues={{
              name: cooperative?.name ?? "",
              upazilaId: cooperative?.locationId ?? "",
              village: cooperative?.village ?? "",
              registrationNo: cooperative?.registrationNo ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
