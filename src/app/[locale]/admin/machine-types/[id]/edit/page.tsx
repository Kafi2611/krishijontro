// Admin page: edit one machine type. The [id] folder means the URL holds the
// type's id, e.g. /en/admin/machine-types/clx123/edit.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MachineTypeForm } from "@/components/admin/machine-type-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { getMachineType } from "@/lib/services/machine-type";
import type { MachineIconName } from "@/lib/validators/machine-type";

type EditMachineTypePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MachineTypesAdmin");
  return { title: t("editTitle") };
}

export default async function EditMachineTypePage({ params }: EditMachineTypePageProps) {
  await requireRole("ADMIN");
  const { id } = await params;
  const machineType = await getMachineType(id);
  if (!machineType) {
    notFound(); // wrong id in the URL -> "Page not found"
  }
  const t = await getTranslations("MachineTypesAdmin");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/admin/machine-types">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("editTitle")} description={machineType.name} />
      <Card>
        <CardContent>
          <MachineTypeForm
            machineTypeId={machineType.id}
            defaultValues={{
              name: machineType.name,
              nameBn: machineType.nameBn,
              category: machineType.category,
              workTypes: machineType.workTypes,
              billingUnit: machineType.billingUnit,
              icon: machineType.icon as MachineIconName,
              isActive: machineType.isActive,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
