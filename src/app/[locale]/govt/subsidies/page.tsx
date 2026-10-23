// Govt page: subsidy programs (/govt/subsidies).
// One card per program: the discount, who may apply, the dates, how much of the budget is
// spent (with a bar), the applications waiting / approved, and a button to change it.
import { Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { DetailRow } from "@/components/detail-row";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { listSubsidyPrograms } from "@/lib/services/subsidy-program";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GovtSubsidies");
  return { title: t("title") };
}

export default async function GovtSubsidiesPage() {
  await requireRole("GOVT");
  const items = await listSubsidyPrograms();
  const t = await getTranslations("GovtSubsidies");
  const format = await getFormatter();
  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild size="lg">
            <Link href="/govt/subsidies/new">
              <Plus aria-hidden />
              {t("add")}
            </Link>
          </Button>
        }
      />

      {items.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}

      <ul className="grid gap-4 lg:grid-cols-2">
        {items.map(({ program, isOpen, pending, approved }) => {
          // How much of the budget is spent, from 0 to 100 (for the bar).
          const spentPercent = Math.min(100, Math.round((program.usedAmount / program.budget) * 100));
          let stateLabel = t("closed");
          if (!program.isActive) {
            stateLabel = t("off");
          } else if (isOpen) {
            stateLabel = t("open");
          }
          return (
            <li key={program.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {pickByLocale(program.name, program.nameBn, locale)}
                    <Badge variant={isOpen ? "default" : "secondary"}>{stateLabel}</Badge>
                  </CardTitle>
                  {program.description && <p className="text-sm text-muted-foreground">{program.description}</p>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl>
                    <DetailRow label={t("discountLabel")}>{t("discount", { percent: program.discountPercent })}</DetailRow>
                    <DetailRow label={t("whoLabel")}>
                      {program.maxLandDecimal !== null ? t("maxLand", { decimal: program.maxLandDecimal }) : t("anyLand")}
                    </DetailRow>
                    <DetailRow label={t("datesLabel")}>
                      {format.dateTimeRange(program.startAt, program.endAt, { dateStyle: "medium" })}
                    </DetailRow>
                    <DetailRow label={t("applicationsLabel")}>{t("applications", { pending, approved })}</DetailRow>
                  </dl>

                  <div className="space-y-1">
                    <p className="text-sm">{t("budgetLine", { used: program.usedAmount, budget: program.budget })}</p>
                    <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${spentPercent}%` }} />
                    </div>
                  </div>

                  <Button asChild variant="outline">
                    <Link href={`/govt/subsidies/${program.id}/edit`}>
                      <Pencil aria-hidden />
                      {t("edit")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
