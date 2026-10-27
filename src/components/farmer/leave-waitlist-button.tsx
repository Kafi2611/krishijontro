"use client";
// The "Leave the list" button on one waitlist entry. The page then shows it as cancelled.
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { leaveWaitlistAction } from "@/lib/actions/waitlist";

export function LeaveWaitlistButton({ entryId }: { entryId: string }) {
  const t = useTranslations("Waitlist");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  function leave() {
    startTransition(async () => {
      const result = await leaveWaitlistAction(entryId);
      if (result.ok) {
        toast.success(t("left"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <Button variant="ghost" disabled={isPending} onClick={leave}>
      <X aria-hidden />
      {t("leave")}
    </Button>
  );
}
