"use client";
// The provider picks which operator takes the machine to an accepted booking.
// Each operator is a big tappable box with their name and phone. An operator who already
// has a job at that time is greyed out ("Busy at that time") and cannot be chosen.
import { Send, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { assignOperatorAction } from "@/lib/actions/booking";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import type { OperatorChoice } from "@/lib/services/booking-queries";
import type { ValidationKey } from "@/lib/validators/types";

type AssignOperatorFormProps = {
  bookingId: string;
  operators: OperatorChoice[];
};

export function AssignOperatorForm({ bookingId, operators }: AssignOperatorFormProps) {
  const t = useTranslations("ProviderBookings");
  const tError = useTranslations("Validation");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [operatorId, setOperatorId] = useState("");
  const [error, setError] = useState<ValidationKey | null>(null);

  /** Sends the chosen operator to the job. The page then redraws with the new status. */
  function assign() {
    if (operatorId === "") {
      setError("chooseOperator");
      return;
    }
    startTransition(async () => {
      const result = await assignOperatorAction(bookingId, { operatorId });
      if (result.ok) {
        toast.success(t("assigned"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  if (operators.length === 0) {
    return (
      <div className="space-y-3">
        <p>{t("noOperators")}</p>
        <Button asChild variant="outline">
          <Link href="/provider/operators/new">
            <UserPlus aria-hidden />
            {t("addOperator")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("assignTitle")}>
        {operators.map((operator) => (
          <OptionCard
            key={operator.id}
            className="min-h-14 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
            inputProps={{
              name: "operatorId",
              value: operator.id,
              checked: operatorId === operator.id,
              disabled: operator.busy,
              onChange: () => {
                setOperatorId(operator.id);
                setError(null);
              },
            }}
          >
            <span className="flex flex-col">
              <span className="font-semibold">{operator.name}</span>
              <span className="text-muted-foreground">
                {operator.busy ? t("busyTag") : localizeDigits(operator.phone, locale)}
              </span>
            </span>
          </OptionCard>
        ))}
      </div>
      {error && <FieldError>{tError(error)}</FieldError>}
      <Button size="lg" disabled={isPending} onClick={assign}>
        <Send aria-hidden />
        {t("assignButton")}
      </Button>
    </div>
  );
}
