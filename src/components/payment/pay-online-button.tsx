"use client";
// The farmer's big "Pay online" button on a finished booking.
// It asks the server to start a payment, then opens the gateway's page: SSLCommerz (another
// website) or our pretend bank page. window.location is used because it can open both.
import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startOnlinePaymentAction } from "@/lib/actions/payment";

type PayOnlineButtonProps = {
  bookingId: string;
  amount: number;
};

export function PayOnlineButton({ bookingId, amount }: PayOnlineButtonProps) {
  const t = useTranslations("Payment");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  /** Starts the payment on the server and goes to the gateway's page. */
  function pay() {
    startTransition(async () => {
      const result = await startOnlinePaymentAction(bookingId);
      if (result.ok) {
        window.location.assign(result.redirectUrl);
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <Button size="lg" className="w-full sm:w-auto" disabled={isPending} onClick={pay}>
      <CreditCard aria-hidden />
      {isPending ? t("opening") : t("payOnline", { amount })}
    </Button>
  );
}
