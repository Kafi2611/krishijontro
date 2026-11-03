// Admin page: platform settings (/admin/settings).
// The admin changes the platform fee %, the farmer's cancellation rules and the emergency
// replacement search here. Machine types have their own page, linked at the bottom.
import { Shapes } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { getPlatformSettings } from "@/lib/services/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminSettings");
  return { title: t("title") };
}

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");
  const settings = await getPlatformSettings();
  const t = await getTranslations("AdminSettings");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsForm current={settings} />

      <Card>
        <CardHeader>
          <CardTitle>{t("machineTypesTitle")}</CardTitle>
          <CardDescription>{t("machineTypesText")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/admin/machine-types">
              <Shapes aria-hidden />
              {t("machineTypesLink")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
