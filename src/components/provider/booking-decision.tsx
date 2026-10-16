"use client";
// The provider's "Accept" and "Reject" buttons for a new booking request.
// "Reject" first opens a box for the reason, because the farmer must know why.
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { acceptBookingAction, rejectBookingAction } from "@/lib/actions/booking";
import type { ValidationKey } from "@/lib/validators/types";

export function BookingDecision({ bookingId }: { bookingId: string }) {
  const t = useTranslations("ProviderBookings");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();
  const [isRejecting, setIsRejecting] = useState(false); // is the reason box open?
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<ValidationKey | null>(null);

  /** Accepts the request. The page then redraws with the "choose an operator" box. */
  function accept() {
    startTransition(async () => {
      const result = await acceptBookingAction(bookingId);
      if (result.ok) {
        toast.success(t("accepted"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  /** Rejects the request with the reason typed in the box. */
  function reject() {
    // Same rule as the server: a reason of at least 3 letters.
    if (reason.trim().length < 3) {
      setReasonError("reasonRequired");
      return;
    }
    startTransition(async () => {
      const result = await rejectBookingAction(bookingId, { reason });
      if (result.ok) {
        toast.success(t("rejected"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  if (isRejecting) {
    return (
      <div className="space-y-3">
        <Field data-invalid={!!reasonError}>
          <FieldLabel htmlFor="reject-reason">{t("reasonLabel")}</FieldLabel>
          <Textarea
            id="reject-reason"
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
          <Button variant="destructive" size="lg" disabled={isPending} onClick={reject}>
            <X aria-hidden />
            {t("confirmReject")}
          </Button>
          <Button variant="ghost" size="lg" disabled={isPending} onClick={() => setIsRejecting(false)}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <Button size="lg" disabled={isPending} onClick={accept}>
        <Check aria-hidden />
        {t("accept")}
      </Button>
      <Button variant="outline" size="lg" disabled={isPending} onClick={() => setIsRejecting(true)}>
        <X aria-hidden />
        {t("reject")}
      </Button>
    </div>
  );
}
