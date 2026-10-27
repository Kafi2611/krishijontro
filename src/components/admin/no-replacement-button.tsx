"use client";
// The admin's "No replacement found" button for a breakdown that is still searching.
// It stands in for the 2-hour wait: pressed, the broken booking is closed (billed only for the
// work done), and the farmer joins the waitlist. A box asks first, because it cannot be undone.
import { SearchX } from "lucide-react";
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
import { markNoReplacementAction } from "@/lib/actions/breakdown";

export function NoReplacementButton({ reportId, code }: { reportId: string; code: string }) {
  const t = useTranslations("AdminBreakdowns");
  const tCommon = useTranslations("Common");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  /** Closes the search. The page then redraws without this breakdown in the open list. */
  function confirmNoReplacement() {
    startTransition(async () => {
      const result = await markNoReplacementAction(reportId);
      if (result.ok) {
        toast.success(t("closed"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isPending}>
          <SearchX aria-hidden />
          {t("noReplacementButton")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle", { code })}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirmText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmNoReplacement}>{t("confirmYes")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
