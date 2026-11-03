// Admin page: make a staff account (/admin/users/new) for a cooperative leader, technician,
// agriculture officer, government user or another admin. These people cannot sign up themselves.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StaffForm } from "@/components/admin/staff-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { listUpazilaOptions } from "@/lib/services/location";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("StaffForm");
  return { title: t("title") };
}

export default async function NewStaffPage() {
  await requireRole("ADMIN");
  const upazilas = await listUpazilaOptions();
  const t = await getTranslations("StaffForm");

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/admin/users">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card>
        <CardContent>
          <StaffForm upazilas={upazilas} />
        </CardContent>
      </Card>
    </div>
  );
}
