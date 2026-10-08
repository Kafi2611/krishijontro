// Provider page: edit one of my machines (/provider/machines/<id>/edit).
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { MachineForm } from "@/components/provider/machine-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { getMachineFormChoices, getProviderMachine } from "@/lib/services/machine";

type EditMachinePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MachineForm");
  return { title: t("editTitle") };
}

export default async function EditMachinePage({ params }: EditMachinePageProps) {
  const provider = await requireRole("PROVIDER");
  const { id } = await params;
  // Only finds the machine if it belongs to THIS provider.
  const [machine, choices] = await Promise.all([
    getProviderMachine(id, provider.id),
    getMachineFormChoices(),
  ]);
  if (!machine) {
    notFound();
  }
  const t = await getTranslations("MachineForm");
  const tDetails = await getTranslations("MachineDetails");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href={`/provider/machines/${machine.id}`}>
          <ArrowLeft aria-hidden />
          {tDetails("backToMachine")}
        </Link>
      </Button>
      <PageHeader title={t("editTitle")} description={`${machine.brand} ${machine.model}`} />
      <Card>
        <CardContent>
          <MachineForm
            {...choices}
            machineId={machine.id}
            defaultValues={{
              machineTypeId: machine.machineTypeId,
              brand: machine.brand,
              model: machine.model,
              year: machine.year,
              horsePower: machine.horsePower ?? undefined,
              registrationNo: machine.registrationNo ?? "",
              description: machine.description ?? "",
              rate: machine.rate,
              locationId: machine.locationId,
              address: machine.address ?? "",
              lat: machine.lat,
              lng: machine.lng,
              engineHours: machine.engineHours,
              serviceDueHours: machine.serviceDueHours,
              imageUrls: machine.images.map((image) => image.url),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
