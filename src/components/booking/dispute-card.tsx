// The complaint box on a booking's page (farmer, provider and admin): the farmer's reason and
// words, and either "an admin is checking it" or the admin's decision with their note.
// The decision line depends on whether the farmer had paid before complaining:
//   paid:     "120 Tk given back to the farmer"
//   not paid: "Bill lowered by 120 Tk" (the farmer then pays the new bill)
import { MessageSquareWarning } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DisputeDecision, DisputeStatus } from "@/generated/prisma/enums";
import { DISPUTE_REASONS, type DisputeReason } from "@/lib/services/dispute-rules";
import { cn } from "@/lib/utils";

/** The Dispute fields this box shows. */
export type CardDispute = {
  reason: string;
  description: string | null;
  status: DisputeStatus;
  decision: DisputeDecision | null;
  refundAmount: number;
  penaltyAmount: number;
  adminNote: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: { name: string } | null;
  wasPaid: boolean; // the farmer had paid before complaining
};

type DisputeCardProps = {
  dispute: CardDispute;
  view: "farmer" | "provider" | "admin";
};

/** True if the saved reason is one of our reason codes (old rows may hold plain text). */
function isReasonCode(reason: string): reason is DisputeReason {
  return (DISPUTE_REASONS as readonly string[]).includes(reason);
}

export function DisputeCard({ dispute, view }: DisputeCardProps) {
  const t = useTranslations("Disputes");
  const format = useFormatter();
  const isOpen = dispute.status === "OPEN";

  /** The decision in one sentence, e.g. "Provider fined 300 Tk". */
  function decisionText(): string {
    if (dispute.decision === "REFUND") {
      return dispute.wasPaid
        ? t("decisionRefundPaid", { amount: dispute.refundAmount })
        : t("decisionRefundBill", { amount: dispute.refundAmount });
    }
    if (dispute.decision === "PENALTY") {
      return t("decisionPenalty", { amount: dispute.penaltyAmount });
    }
    return t("decisionNone");
  }

  return (
    <Card className={cn(isOpen && "border-amber-300 bg-amber-50")}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <MessageSquareWarning className="size-5 text-amber-700" aria-hidden />
            {t("cardTitle")}
          </span>
          <StatusBadge status={dispute.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-semibold">{isReasonCode(dispute.reason) ? t(`reasons.${dispute.reason}`) : dispute.reason}</p>
          {dispute.description && <p className="text-sm">“{dispute.description}”</p>}
          <p className="text-sm text-muted-foreground">
            {t("raisedOn", { date: format.dateTime(dispute.createdAt, { dateStyle: "medium", timeStyle: "short" }) })}
          </p>
        </div>

        {isOpen ? (
          <p className="text-sm">{t(`openText.${view}`)}</p>
        ) : (
          <div className="space-y-1 rounded-lg bg-background p-3">
            <p className="font-semibold">{decisionText()}</p>
            {dispute.adminNote && <p className="text-sm">{t("adminNote", { note: dispute.adminNote })}</p>}
            {dispute.resolvedAt && (
              <p className="text-sm text-muted-foreground">
                {t("decidedOn", {
                  name: dispute.resolvedBy?.name ?? "",
                  date: format.dateTime(dispute.resolvedAt, { dateStyle: "medium" }),
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
