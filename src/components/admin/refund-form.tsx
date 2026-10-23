"use client";
// The admin's "Refund" button under a successful payment. It opens a small form: how much
// to give back (at most what is left) and why (the farmer sees the reason).
// Zod (refundSchema) checks it here and again on the server; the server also checks the amount
// against what is left, inside a locked transaction (lib/services/refund.ts).
import { zodResolver } from "@hookform/resolvers/zod";
import { Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { refundPaymentAction } from "@/lib/actions/payment";
import { numberFromInput } from "@/lib/form-values";
import { refundSchema, type RefundInput } from "@/lib/validators/payment";
import type { ValidationKey } from "@/lib/validators/types";

type RefundFormProps = {
  paymentId: string;
  refundable: number; // the most that can still be given back
  isCash: boolean; // a cash payment is given back by hand, not through a gateway
};

export function RefundForm({ paymentId, refundable, isCash }: RefundFormProps) {
  const t = useTranslations("AdminPayments");
  const tError = useTranslations("Validation");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<RefundInput>({
    resolver: zodResolver(refundSchema),
    defaultValues: { amount: refundable, reason: "" },
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: asks the server to give the money back. */
  function onSubmit(values: RefundInput) {
    startTransition(async () => {
      const result = await refundPaymentAction(paymentId, values);
      if (result.ok) {
        toast.success(t("refunded"));
        setIsOpen(false);
        form.reset({ amount: refundable - values.amount, reason: "" });
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <Undo2 aria-hidden />
        {t("refund")}
      </Button>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="rounded-lg border p-3">
      <FieldGroup>
        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor={`refund-amount-${paymentId}`}>{t("refundAmount")}</FieldLabel>
          <Input
            id={`refund-amount-${paymentId}`}
            inputMode="numeric"
            aria-invalid={!!errors.amount}
            {...form.register("amount", { setValueAs: numberFromInput })}
          />
          <FieldDescription>{t("refundable", { amount: refundable })}</FieldDescription>
          {errors.amount?.message && <FieldError>{tError(errors.amount.message as ValidationKey)}</FieldError>}
        </Field>
        <Field data-invalid={!!errors.reason}>
          <FieldLabel htmlFor={`refund-reason-${paymentId}`}>{t("refundReason")}</FieldLabel>
          <Textarea
            id={`refund-reason-${paymentId}`}
            rows={2}
            placeholder={t("refundReasonPlaceholder")}
            aria-invalid={!!errors.reason}
            {...form.register("reason")}
          />
          {errors.reason?.message && <FieldError>{tError(errors.reason.message as ValidationKey)}</FieldError>}
        </Field>
        {isCash && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{t("cashRefundNote")}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="destructive" disabled={isPending}>
            <Undo2 aria-hidden />
            {t("confirmRefund")}
          </Button>
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => setIsOpen(false)}>
            {t("cancel")}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
