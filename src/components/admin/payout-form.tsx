"use client";
// The admin's payout form for one provider: after sending the money (e.g. by bKash), the admin
// types the transfer's reference and presses "I have sent ... Tk". The server then puts all the
// provider's paid bookings into one payout (lib/services/payout.ts) and tells the provider.
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createPayoutAction } from "@/lib/actions/payment";
import { payoutSchema, type PayoutInput } from "@/lib/validators/payment";
import type { ValidationKey } from "@/lib/validators/types";

type PayoutFormProps = {
  providerId: string;
  amount: number; // what we owe this provider now
};

export function PayoutForm({ providerId, amount }: PayoutFormProps) {
  const t = useTranslations("AdminPayments");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  const form = useForm<PayoutInput>({
    resolver: zodResolver(payoutSchema),
    defaultValues: { reference: "" },
  });
  const error = form.formState.errors.reference;

  /** Runs when the Zod check passed: saves the payout. The provider then leaves this list. */
  function onSubmit(values: PayoutInput) {
    startTransition(async () => {
      const result = await createPayoutAction(providerId, values);
      if (result.ok) {
        toast.success(t("payoutSaved"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field data-invalid={!!error} className="flex-1">
        <FieldLabel htmlFor={`reference-${providerId}`}>{t("reference")}</FieldLabel>
        <Input
          id={`reference-${providerId}`}
          placeholder={t("referencePlaceholder")}
          aria-invalid={!!error}
          {...form.register("reference")}
        />
        {error?.message && <FieldError>{tError(error.message as ValidationKey)}</FieldError>}
      </Field>
      <Button type="submit" disabled={isPending}>
        <Send aria-hidden />
        {t("markPaid", { amount })}
      </Button>
    </form>
  );
}
