// A coloured note at the top of provider pages while the provider's own account
// is not approved yet (PENDING) or was rejected. Shows nothing once approved.
import { CircleAlert, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ApprovalStatus } from "@/generated/prisma/enums";

export function ProviderApprovalNote({ approvalStatus }: { approvalStatus: ApprovalStatus }) {
  const t = useTranslations("ProviderNotes");

  if (approvalStatus === "APPROVED") {
    return null;
  }

  const isRejected = approvalStatus === "REJECTED";
  const Icon = isRejected ? CircleAlert : Clock;
  return (
    <div
      role="status"
      className={
        isRejected
          ? "flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          : "flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
      }
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p>{isRejected ? t("accountRejected") : t("accountPending")}</p>
    </div>
  );
}
