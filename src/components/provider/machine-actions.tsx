"use client";
// Buttons on a machine's page: "Stop renting" / "Start renting" and "Delete".
// Delete first opens an "Are you sure?" pop-up.
import { Pause, Play, Trash2 } from "lucide-react";
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
import type { MachineStatus } from "@/generated/prisma/enums";
import { deleteMachineAction, setMachineActiveAction } from "@/lib/actions/machine";
import { useRouter } from "@/lib/navigation";

type MachineActionsProps = {
  machineId: string;
  status: MachineStatus;
};

export function MachineActions({ machineId, status }: MachineActionsProps) {
  const t = useTranslations("MachineDetails");
  const tError = useTranslations("Validation");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isActive = status === "ACTIVE";

  /** Switches the machine on (ACTIVE) or off (INACTIVE). The page refreshes by itself. */
  function toggleActive() {
    startTransition(async () => {
      const result = await setMachineActiveAction(machineId, !isActive);
      if (result.ok) {
        toast.success(isActive ? t("stoppedRenting") : t("startedRenting"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  /** Deletes the machine, then goes back to the machine list. */
  function deleteMachine() {
    startTransition(async () => {
      const result = await deleteMachineAction(machineId);
      if (result.ok) {
        toast.success(t("deleted"));
        router.push("/provider/machines");
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "UNDER_MAINTENANCE" && (
        <Button variant="outline" disabled={isPending} onClick={toggleActive}>
          {isActive ? <Pause aria-hidden /> : <Play aria-hidden />}
          {isActive ? t("stopRenting") : t("startRenting")}
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={isPending}>
            <Trash2 aria-hidden />
            {t("delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteMachine}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
