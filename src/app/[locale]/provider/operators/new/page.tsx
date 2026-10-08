// Provider page: add a new operator (creates the operator's login account).
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { OperatorForm } from "@/components/provider/operator-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Operators");
  return { title: t("newTitle") };
}

export default async function NewOperatorPage() {
  await requireRole("PROVIDER");
  const t = await getTranslations("Operators");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/provider/operators">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <Card>
        <CardContent>
          <OperatorForm />
        </CardContent>
      </Card>
    </div>
  );
}
