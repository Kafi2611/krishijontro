"use client";
// The provider's "Send this machine" button on an emergency offer. A box asks first, because
// the booking is accepted at once and the machine must leave soon. The first provider to press
// it gets the job; anyone later is told another provider was faster.
import { Truck } from "lucide-react";
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
import { acceptReplacementAction } from "@/lib/actions/breakdown";

type SendReplacementButtonProps = {
  reportId: string;
  machineId: string;
  machineName: string;
  startTime: string; // already formatted, e.g. "11:00 AM"
};

export function SendReplacementButton({ reportId, machineId, machineName, startTime }: SendReplacementButtonProps) {
  const t = useTranslations("Replacement");
  const tCommon = useTranslations("Common");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  /** Sends the machine. The page then redraws: the new booking waits for an operator. */
  function send() {
    startTransition(async () => {
      const result = await acceptReplacementAction(reportId, machineId);
      if (result.ok) {
        toast.success(t("sent"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto" disabled={isPending}>
          <Truck aria-hidden />
          {t("sendButton")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle", { machine: machineName })}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirmText", { time: startTime })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={send}>{t("confirmYes")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
