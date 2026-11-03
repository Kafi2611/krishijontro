"use client";
// The admin's decision on one open complaint. Three big buttons, then the box that decision needs:
//   Refund   — paid before: how much money to give back (at most what is left of the payment)
//              not paid:    the RIGHT amount of work; the bill is worked out again (lower)
//   Fine     — how much the provider pays (at most their share of this booking)
//   No action
// and a note that the farmer and the provider both read. Zod (decisionSchema) checks the form
// here and again on the server; the server also checks the amounts against the booking.
import { zodResolver } from "@hookform/resolvers/zod";
import { Gavel } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BillingUnit } from "@/generated/prisma/enums";
import { decideDisputeAction } from "@/lib/actions/dispute";
import { numberFromInput } from "@/lib/form-values";
import { DISPUTE_DECISIONS } from "@/lib/services/dispute-rules";
import { decisionSchema, type DecisionInput } from "@/lib/validators/dispute";
import type { ValidationKey } from "@/lib/validators/types";

type DisputeDecisionFormProps = {
  disputeId: string;
  wasPaid: boolean; // paid before the complaint: a refund gives money back
  refundable: number; // the most money that can still be given back
  providerShare: number; // the biggest fine allowed
  billingUnit: BillingUnit;
  currentWork: number; // the work on the bill now (decimal for PER_ACRE, else hours / days)
};

/**
 * An empty box counts as 0 (not "missing"): the box of the other decision may be empty, and
 * the "an amount is needed" rule in decisionSchema still catches an empty box that is needed.
 */
function emptyIsZero(value: unknown): number {
  return numberFromInput(value) ?? 0;
}

export function DisputeDecisionForm({
  disputeId,
  wasPaid,
  refundable,
  providerShare,
  billingUnit,
  currentWork,
}: DisputeDecisionFormProps) {
  const t = useTranslations("AdminDisputes");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  const form = useForm<DecisionInput>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: "NO_ACTION", amountTk: 0, correctedWork: 0, note: "" },
  });
  const errors = form.formState.errors;
  const decision = useWatch({ control: form.control, name: "decision" });
  // A refund before paying asks for the right work instead of money.
  const asksForWork = decision === "REFUND" && !wasPaid;
  const asksForMoney = decision === "PENALTY" || (decision === "REFUND" && wasPaid);

  /** Runs when the Zod check passed: saves the decision. The page then moves it to "Decided". */
  function onSubmit(values: DecisionInput) {
    // Send 0 for the box that this decision does not use, so an old number is never used by mistake.
    const cleaned: DecisionInput = {
      ...values,
      amountTk: asksForMoney ? values.amountTk : 0,
      correctedWork: asksForWork ? values.correctedWork : 0,
    };
    startTransition(async () => {
      const result = await decideDisputeAction(disputeId, cleaned);
      if (result.ok) {
        toast.success(t("decided"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  /** The translated error under a field, if that field has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="rounded-lg border p-3">
      <FieldGroup>
        <FieldSet>
          <FieldLegend>{t("decisionLabel")}</FieldLegend>
          <div className="grid gap-2 sm:grid-cols-3">
            {DISPUTE_DECISIONS.map((choice) => (
              <OptionCard key={choice} inputProps={{ value: choice, ...form.register("decision") }}>
                {choice === "REFUND" ? (wasPaid ? t("refundPaid") : t("refundBill")) : t(`decisions.${choice}`)}
              </OptionCard>
            ))}
          </div>
        </FieldSet>

        {asksForMoney && (
          <Field data-invalid={!!errors.amountTk}>
            <FieldLabel htmlFor={`amount-${disputeId}`}>
              {decision === "PENALTY" ? t("fineAmount") : t("refundAmount")}
            </FieldLabel>
            <Input
              id={`amount-${disputeId}`}
              inputMode="numeric"
              className="max-w-40"
              aria-invalid={!!errors.amountTk}
              {...form.register("amountTk", { setValueAs: emptyIsZero })}
            />
            <FieldDescription>
              {decision === "PENALTY" ? t("fineLimit", { amount: providerShare }) : t("refundLimit", { amount: refundable })}
            </FieldDescription>
            {errorText(errors.amountTk?.message)}
          </Field>
        )}

        {asksForWork && (
          <Field data-invalid={!!errors.correctedWork || !!errors.amountTk}>
            <FieldLabel htmlFor={`work-${disputeId}`}>{t("correctedWork", { unit: billingUnit })}</FieldLabel>
            <Input
              id={`work-${disputeId}`}
              inputMode="decimal"
              className="max-w-40"
              aria-invalid={!!errors.correctedWork}
              {...form.register("correctedWork", { setValueAs: emptyIsZero })}
            />
            <FieldDescription>{t("correctedWorkHint", { amount: currentWork, unit: billingUnit })}</FieldDescription>
            {/* The "refund needs an amount" rule is reported on amountTk; show it here too. */}
            {errorText(errors.correctedWork?.message ?? errors.amountTk?.message)}
          </Field>
        )}

        <Field data-invalid={!!errors.note}>
          <FieldLabel htmlFor={`note-${disputeId}`}>{t("note")}</FieldLabel>
          <Textarea
            id={`note-${disputeId}`}
            rows={2}
            placeholder={t("notePlaceholder")}
            aria-invalid={!!errors.note}
            {...form.register("note")}
          />
          {errorText(errors.note?.message)}
        </Field>

        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          <Gavel aria-hidden />
          {t("saveDecision")}
        </Button>
      </FieldGroup>
    </form>
  );
}
