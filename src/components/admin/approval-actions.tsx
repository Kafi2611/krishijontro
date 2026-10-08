"use client";
// The "Approve" and "Reject" buttons under each item on the admin's approvals page.
// "Reject" first opens a box for the reason, because the owner must know what to fix.
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { decideApprovalAction } from "@/lib/actions/approval";
import type { ApprovalTarget } from "@/lib/validators/approval";
import type { ValidationKey } from "@/lib/validators/types";

type ApprovalActionsProps = {
  target: ApprovalTarget;
  id: string;
};

export function ApprovalActions({ target, id }: ApprovalActionsProps) {
  const t = useTranslations("Approvals");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();
  const [isRejecting, setIsRejecting] = useState(false); // is the reason box open?
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<ValidationKey | null>(null);

  /** Sends the decision to the server. The page then redraws without this item. */
  function decide(approve: boolean) {
    // Same rule as the server: a rejection needs a reason of at least 3 letters.
    if (!approve && reason.trim().length < 3) {
      setReasonError("reasonRequired");
      return;
    }
    startTransition(async () => {
      const result = await decideApprovalAction(target, id, { approve, reason });
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
            placeholder={t("reasonPlaceholder")}
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
      <Button disabled={isPending} onClick={() => decide(true)}>
        <Check aria-hidden />
        {t("approve")}
      </Button>
      <Button variant="outline" disabled={isPending} onClick={() => setIsRejecting(true)}>
        <X aria-hidden />
        {t("reject")}
      </Button>
    </div>
  );
}
