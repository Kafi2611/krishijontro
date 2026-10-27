"use client";
// The farmer's "Cancel the booking" button. A box asks first and repeats the fee (or that it is
// free), because a cancelled booking cannot be opened again. The server works the fee out again
// at the moment of cancelling, so the farmer always pays what the rules say at that moment.
import { CalendarX } from "lucide-react";
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
import { cancelBookingAction } from "@/lib/actions/booking";

export function CancelBookingButton({ bookingId, fee }: { bookingId: string; fee: number }) {
  const t = useTranslations("Cancel");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  /** Cancels the booking. The page then redraws as "Cancelled". */
  function confirmCancel() {
    startTransition(async () => {
      const result = await cancelBookingAction(bookingId);
      if (result.ok) {
        toast.success(t("cancelled"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className="w-full bg-background sm:w-auto" disabled={isPending}>
          <CalendarX aria-hidden />
          {t("button")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{fee > 0 ? t("confirmFee", { fee }) : t("confirmFree")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmCancel}>{t("confirmYes")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
