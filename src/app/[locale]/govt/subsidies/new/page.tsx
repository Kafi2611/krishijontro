// Govt page: create a subsidy program (/govt/subsidies/new).
// The form starts with common values: 20% off, for farmers with up to 200 decimal, from today
// for one year, switched on.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SubsidyProgramForm } from "@/components/govt/subsidy-program-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { addDays, toDhakaDay } from "@/lib/services/calendar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GovtSubsidies");
  return { title: t("newTitle") };
}

export default async function NewSubsidyProgramPage() {
  await requireRole("GOVT");
  const t = await getTranslations("GovtSubsidies");
  const today = toDhakaDay(new Date());

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/govt/subsidies">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("newTitle")} />
      <Card>
        <CardContent>
          <SubsidyProgramForm
            programId={null}
            defaultValues={{
              name: "",
              nameBn: "",
              description: "",
              discountPercent: 20,
              maxLandDecimal: 200,
              startDay: today,
              endDay: addDays(today, 364),
              isActive: true,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
