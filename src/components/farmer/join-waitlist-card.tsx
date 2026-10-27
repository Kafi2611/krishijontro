"use client";
// The "No free machine?" box under an empty search: one button joins the waitlist for the kind
// of machine the farmer needs, on the searched day, with the searched field and land.
// When such a machine becomes free nearby, the first farmer in the line gets a message.
import { Hourglass } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { joinWaitlistAction } from "@/lib/actions/waitlist";
import { Link } from "@/lib/navigation";
import type { JoinWaitlistInput } from "@/lib/validators/waitlist";

type JoinWaitlistCardProps = {
  values: JoinWaitlistInput; // taken from the farmer's search
  machineTypeName: string; // e.g. "Combine Harvester", already in the reader's language
};

export function JoinWaitlistCard({ values, machineTypeName }: JoinWaitlistCardProps) {
  const t = useTranslations("Waitlist");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();
  const [hasJoined, setHasJoined] = useState(false);

  function join() {
    startTransition(async () => {
      const result = await joinWaitlistAction(values);
      if (result.ok) {
        toast.success(t("joined"));
        setHasJoined(true);
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <Card className="bg-accent">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Hourglass className="size-8 shrink-0 text-primary" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold">{t("joinTitle")}</p>
          <p className="text-muted-foreground">{t("joinText", { type: machineTypeName })}</p>
        </div>
        {hasJoined ? (
          <Button asChild variant="outline" size="lg">
            <Link href="/farmer/waitlist">{t("seeList")}</Link>
          </Button>
        ) : (
          <Button size="lg" disabled={isPending} onClick={join}>
            <Hourglass aria-hidden />
            {t("joinButton")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
