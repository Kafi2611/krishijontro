// Provider page: add a new machine.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { MachineForm } from "@/components/provider/machine-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { getMachineFormChoices } from "@/lib/services/machine";
import { getProviderProfile } from "@/lib/services/provider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MachineForm");
  return { title: t("newTitle") };
}

export default async function NewMachinePage() {
  const provider = await requireRole("PROVIDER");
  const [choices, profile] = await Promise.all([
    getMachineFormChoices(),
    getProviderProfile(provider.id),
  ]);
  const t = await getTranslations("MachineForm");
  const tDetails = await getTranslations("MachineDetails");

  // Start the form in the provider's own upazila (if set), with the map pin at its centre.
  const home = profile?.location;
  const startPoint = home?.lat != null && home.lng != null ? { lat: home.lat, lng: home.lng } : {};

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/provider/machines">
          <ArrowLeft aria-hidden />
          {tDetails("back")}
        </Link>
      </Button>
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <Card>
        <CardContent>
          <MachineForm
            {...choices}
            defaultValues={{
              machineTypeId: "",
              brand: "",
              model: "",
              registrationNo: "",
              description: "",
              locationId: home?.id ?? "",
              ...startPoint,
              address: "",
              engineHours: 0,
              serviceDueHours: 250,
              imageUrls: [],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
