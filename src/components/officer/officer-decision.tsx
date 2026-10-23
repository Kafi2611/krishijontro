"use client";
// The agriculture officer's "Approve" and "Reject" buttons, used on two pages:
//   kind "farmer"  — verify a farmer's NID and land
//   kind "subsidy" — approve a subsidy application
// "Reject" first opens a box for the reason, because the farmer must know what to fix.
// When the item cannot be approved yet (e.g. the farmer is not verified), only Reject is shown.
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { decideSubsidyAction } from "@/lib/actions/subsidy";
import { decideVerificationAction } from "@/lib/actions/verification";
import type { ActionResult, ValidationKey } from "@/lib/validators/types";

type OfficerDecisionProps = {
  kind: "farmer" | "subsidy";
  id: string; // the farmer's user id, or the application id
  canApprove: boolean;
};

export function OfficerDecision({ kind, id, canApprove }: OfficerDecisionProps) {
  const t = useTranslations("OfficerDecision");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();
  const [isRejecting, setIsRejecting] = useState(false); // is the reason box open?
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<ValidationKey | null>(null);

  /** Sends the decision to the right server action. The page then redraws without this item. */
  function decide(approve: boolean) {
    // Same rule as the server: a rejection needs a reason of at least 3 letters.
    if (!approve && reason.trim().length < 3) {
      setReasonError("reasonRequired");
      return;
    }
    startTransition(async () => {
      const decision = { approve, reason };
      let result: ActionResult;
      if (kind === "farmer") {
        result = await decideVerificationAction(id, decision);
      } else {
        result = await decideSubsidyAction(id, decision);
      }
      if (result.ok) {
        toast.success(approve ? t("approved") : t("rejected"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  if (isRejecting) {
    return (
      <div className="space-y-3">
        <Field data-invalid={!!reasonError}>
          <FieldLabel htmlFor={`reason-${id}`}>{t("reasonLabel")}</FieldLabel>
          <Textarea
            id={`reason-${id}`}
            rows={2}
            value={reason}
            placeholder={kind === "farmer" ? t("farmerReasonPlaceholder") : t("subsidyReasonPlaceholder")}
            aria-invalid={!!reasonError}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(null);
            }}
          />
          {reasonError && <FieldError>{tError(reasonError)}</FieldError>}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" disabled={isPending} onClick={() => decide(false)}>
            <X aria-hidden />
            {t("confirmReject")}
          </Button>
          <Button variant="ghost" disabled={isPending} onClick={() => setIsRejecting(false)}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canApprove && (
        <Button disabled={isPending} onClick={() => decide(true)}>
          <Check aria-hidden />
          {kind === "farmer" ? t("verify") : t("approve")}
        </Button>
      )}
      <Button variant="outline" disabled={isPending} onClick={() => setIsRejecting(true)}>
        <X aria-hidden />
        {t("reject")}
      </Button>
    </div>
  );
}
