// Admin page: add a new machine type.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MachineTypeForm } from "@/components/admin/machine-type-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MachineTypesAdmin");
  return { title: t("newTitle") };
}

export default async function NewMachineTypePage() {
  await requireRole("ADMIN");
  const t = await getTranslations("MachineTypesAdmin");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/admin/machine-types">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("newTitle")} />
      <Card>
        <CardContent>
          <MachineTypeForm
            defaultValues={{
              name: "",
              nameBn: "",
              category: "LAND_PREPARATION",
              workTypes: [],
              billingUnit: "PER_ACRE",
              icon: "Tractor",
              isActive: true,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
