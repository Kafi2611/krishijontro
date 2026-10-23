// Govt page: change a subsidy program (/govt/subsidies/<id>/edit).
// The form starts with the saved values. The budget may not go below what is already spent.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SubsidyProgramForm } from "@/components/govt/subsidy-program-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getSubsidyProgram, programToFormValues } from "@/lib/services/subsidy-program";

type EditSubsidyProgramPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GovtSubsidies");
  return { title: t("editTitle") };
}

export default async function EditSubsidyProgramPage({ params }: EditSubsidyProgramPageProps) {
  await requireRole("GOVT");
  const { id } = await params;
  const program = await getSubsidyProgram(id);
  if (!program) {
    notFound(); // wrong id in the URL -> "Page not found"
  }
  const t = await getTranslations("GovtSubsidies");
  const tPrice = await getTranslations("Price");
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/govt/subsidies">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={pickByLocale(program.name, program.nameBn, locale)}
        description={t("editSubtitle", { used: tPrice("amount", { amount: program.usedAmount }) })}
      />
      <Card>
        <CardContent>
          <SubsidyProgramForm programId={program.id} defaultValues={programToFormValues(program)} />
        </CardContent>
      </Card>
    </div>
  );
}
