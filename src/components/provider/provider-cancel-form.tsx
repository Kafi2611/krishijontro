"use client";
// The provider's "Cancel the booking" box for a booking they accepted but cannot do any more.
// It starts as one button. Pressed, it asks for the reason (the farmer is told why) and warns
// that the trust score goes down, then cancels. The farmer pays nothing.
import { CalendarX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { providerCancelBookingAction } from "@/lib/actions/booking";
import type { ValidationKey } from "@/lib/validators/types";

export function ProviderCancelForm({ bookingId }: { bookingId: string }) {
  const t = useTranslations("Cancel");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false); // is the reason box open?
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<ValidationKey | null>(null);

  /** Cancels with the reason typed in the box. */
  function cancelBooking() {
    // Same rule as the server: a reason of at least 3 letters.
    if (reason.trim().length < 3) {
      setReasonError("reasonRequired");
      return;
    }
    startTransition(async () => {
      const result = await providerCancelBookingAction(bookingId, { reason });
      if (result.ok) {
        toast.success(t("providerCancelled"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => setIsOpen(true)}>
        <CalendarX aria-hidden />
        {t("button")}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <Field data-invalid={!!reasonError}>
        <FieldLabel htmlFor="cancel-reason">{t("reasonLabel")}</FieldLabel>
        <Textarea
          id="cancel-reason"
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
        <Button variant="destructive" size="lg" disabled={isPending} onClick={cancelBooking}>
          <CalendarX aria-hidden />
          {t("providerConfirm")}
        </Button>
        <Button variant="ghost" size="lg" disabled={isPending} onClick={() => setIsOpen(false)}>
          {t("keep")}
        </Button>
      </div>
    </div>
  );
}
