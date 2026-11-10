"use client";
// The farmer's "Get a new code" button. It only shows when the start or finish code is locked
// (a wrong code was typed 5 times). The server makes a new code (renewOtp in
// lib/services/booking.ts), the page is drawn again and shows the new code.
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { renewOtpAction } from "@/lib/actions/booking";

export function RenewOtpButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations("BookingView");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  /** Asks the server for a new code, then tells the farmer what happened. */
  function getNewCode() {
    startTransition(async () => {
      const result = await renewOtpAction(bookingId);
      if (result.ok) {
        toast.success(t("otpRenewed"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <Button type="button" size="lg" disabled={isPending} onClick={getNewCode} className="w-full sm:w-auto">
      <RefreshCw aria-hidden />
      {t("otpRenew")}
    </Button>
  );
}
