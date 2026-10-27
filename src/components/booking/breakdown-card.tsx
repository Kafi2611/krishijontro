// The breakdown box on a booking's page (farmer, provider and operator): what went wrong, the
// operator's photo, how much work was done before it, and how the search for a replacement
// machine is going. The last line explains what happens next, for the person reading it.
import { TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BillingUnit, BreakdownStatus } from "@/generated/prisma/enums";

type BreakdownCardProps = {
  report: {
    status: BreakdownStatus;
    description: string;
    photoUrl: string | null;
    completedQuantity: number; // in the billing unit (acres, hours or days)
    createdAt: Date;
    reportedBy: { name: string };
  };
  billingUnit: BillingUnit;
  view: "farmer" | "provider" | "operator";
  radiusKm: number; // how far we look for a replacement (a setting)
};

export function BreakdownCard({ report, billingUnit, view, radiusKm }: BreakdownCardProps) {
  const t = useTranslations("Breakdown");
  const tView = useTranslations("BookingView");
  const format = useFormatter();

  // What happens next, for this reader.
  let nextText = t("replacedText");
  if (report.status === "SEARCHING") {
    nextText = t(`searchingText.${view}`, { km: radiusKm });
  } else if (report.status === "NO_REPLACEMENT") {
    nextText = view === "farmer" ? t("noReplacementFarmer") : t("noReplacementText");
  }

  return (
    <Card className="border-orange-300 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <TriangleAlert className="size-5 text-orange-700" aria-hidden />
          {t("cardTitle")}
          <StatusBadge status={report.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-medium">{report.description}</p>
        {report.photoUrl && (
          <div className="relative aspect-[4/3] max-w-sm overflow-hidden rounded-lg bg-muted">
            <Image src={report.photoUrl} alt={t("photoAlt")} fill sizes="384px" className="object-cover" />
          </div>
        )}
        <p className="text-sm">
          {t("workDone")}: {tView("quantity", { quantity: report.completedQuantity, unit: billingUnit })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("reportedBy", {
            name: report.reportedBy.name,
            time: format.dateTime(report.createdAt, { dateStyle: "medium", timeStyle: "short" }),
          })}
        </p>
        <p className="rounded-lg bg-background p-3 text-sm">{nextText}</p>
      </CardContent>
    </Card>
  );
}
