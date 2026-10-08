"use client";
// The "Remove" button next to a blocked-days row: makes those days free again.
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeAvailabilityBlockAction } from "@/lib/actions/availability";

export function RemoveBlockButton({ blockId }: { blockId: string }) {
  const t = useTranslations("Calendar");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  /** Asks the server to delete the block; the page then redraws without it. */
  function removeBlock() {
    startTransition(async () => {
      const result = await removeAvailabilityBlockAction(blockId);
      if (result.ok) {
        toast.success(t("removed"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <Button variant="outline" disabled={isPending} onClick={removeBlock}>
      <Trash2 aria-hidden />
      {t("remove")}
    </Button>
  );
}
