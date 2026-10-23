"use client";
// The "Cash received" button for the operator (at the field) and the provider.
// A box asks "Did you receive ... Tk in cash?" first, because a booking marked as paid cannot
// be changed back. The server then saves the cash payment and marks the booking PAID.
import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { recordCashPaymentAction } from "@/lib/actions/payment";

type CashReceivedButtonProps = {
  bookingId: string;
  amount: number; // what the farmer pays
};

export function CashReceivedButton({ bookingId, amount }: CashReceivedButtonProps) {
  const t = useTranslations("Payment");
  const tCommon = useTranslations("Common");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  /** Saves the cash payment. The page then redraws as "Paid". */
  function confirmCash() {
    startTransition(async () => {
      const result = await recordCashPaymentAction(bookingId);
      if (result.ok) {
        toast.success(t("cashSaved"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto" disabled={isPending}>
          <Banknote aria-hidden />
          {t("cashReceived", { amount })}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("cashConfirmTitle", { amount })}</AlertDialogTitle>
          <AlertDialogDescription>{t("cashConfirmText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmCash}>{t("cashConfirmYes")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
