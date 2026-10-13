"use client";
// The government's form to set the price limit of one machine type:
// lowest and highest rate, harvest season (dates + extra %), delivery charge and
// the minimum charge. Zod (pricingRuleSchema) checks it here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { BillingUnit } from "@/generated/prisma/enums";
import { savePricingRuleAction } from "@/lib/actions/pricing-rule";
import { numberFromInput } from "@/lib/form-values";
import { useRouter } from "@/lib/navigation";
import { pricingRuleSchema, type PricingRuleInput } from "@/lib/validators/pricing-rule";
import type { ValidationKey } from "@/lib/validators/types";

type PricingRuleFormProps = {
  machineTypeId: string;
  billingUnit: BillingUnit; // shown in the labels, e.g. "Tk per acre"
  defaultValues: Partial<PricingRuleInput>;
};

export function PricingRuleForm({ machineTypeId, billingUnit, defaultValues }: PricingRuleFormProps) {
  const t = useTranslations("GovtPricing");
  const tError = useTranslations("Validation");
  const router = useRouter();
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<PricingRuleInput>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues,
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: saves on the server, then goes back to the list. */
  function onSubmit(values: PricingRuleInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await savePricingRuleAction(machineTypeId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(t("saved"));
      if (result.machinesOutside > 0) {
        toast.warning(t("machinesOutside", { count: result.machinesOutside }));
      }
      router.push("/govt/pricing");
    });
  }

  /** The translated error under a field, if that field has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  /** A number box connected to the form (Bangla digits are allowed). */
  function numberInput(name: keyof PricingRuleInput, inputMode: "numeric" | "decimal") {
    return (
      <Input
        id={name}
        inputMode={inputMode}
        aria-invalid={!!errors[name]}
        {...form.register(name, { setValueAs: numberFromInput })}
      />
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {/* ── 1. Rate limit ── */}
        <FieldSet>
          <FieldLegend>{t("sectionRate")}</FieldLegend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.minRate}>
              <FieldLabel htmlFor="minRate">{t("minRate", { unit: billingUnit })}</FieldLabel>
              {numberInput("minRate", "numeric")}
              {errorText(errors.minRate?.message)}
            </Field>
            <Field data-invalid={!!errors.maxRate}>
              <FieldLabel htmlFor="maxRate">{t("maxRate", { unit: billingUnit })}</FieldLabel>
              {numberInput("maxRate", "numeric")}
              {errorText(errors.maxRate?.message)}
            </Field>
          </div>
        </FieldSet>

        {/* ── 2. Harvest season ── */}
        <FieldSet>
          <FieldLegend>{t("sectionSeason")}</FieldLegend>
          <FieldDescription>{t("seasonHint")}</FieldDescription>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field data-invalid={!!errors.harvestSeasonStart}>
              <FieldLabel htmlFor="harvestSeasonStart">{t("seasonStart")}</FieldLabel>
              <Input id="harvestSeasonStart" type="date" {...form.register("harvestSeasonStart")} />
              {errorText(errors.harvestSeasonStart?.message)}
            </Field>
            <Field data-invalid={!!errors.harvestSeasonEnd}>
              <FieldLabel htmlFor="harvestSeasonEnd">{t("seasonEnd")}</FieldLabel>
              <Input id="harvestSeasonEnd" type="date" {...form.register("harvestSeasonEnd")} />
              {errorText(errors.harvestSeasonEnd?.message)}
            </Field>
            <Field data-invalid={!!errors.seasonCapPercent}>
              <FieldLabel htmlFor="seasonCapPercent">{t("seasonCap")}</FieldLabel>
              {numberInput("seasonCapPercent", "numeric")}
              {errorText(errors.seasonCapPercent?.message)}
            </Field>
          </div>
        </FieldSet>

        {/* ── 3. Delivery ── */}
        <FieldSet>
          <FieldLegend>{t("sectionDelivery")}</FieldLegend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.deliveryRatePerKm}>
              <FieldLabel htmlFor="deliveryRatePerKm">{t("deliveryRatePerKm")}</FieldLabel>
              {numberInput("deliveryRatePerKm", "numeric")}
              {errorText(errors.deliveryRatePerKm?.message)}
            </Field>
            <Field data-invalid={!!errors.freeKm}>
              <FieldLabel htmlFor="freeKm">{t("freeKm")}</FieldLabel>
              {numberInput("freeKm", "decimal")}
              {errorText(errors.freeKm?.message)}
            </Field>
          </div>
          <FieldDescription>{t("deliveryHint")}</FieldDescription>
        </FieldSet>

        {/* ── 4. Minimum charge ── */}
        <Field data-invalid={!!errors.minCharge}>
          <FieldLabel htmlFor="minCharge">{t("minCharge", { unit: billingUnit })}</FieldLabel>
          {numberInput("minCharge", "decimal")}
          <FieldDescription>{t("minChargeHint")}</FieldDescription>
          {errorText(errors.minCharge?.message)}
        </Field>

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <div className="space-y-2">
          <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
            <Save aria-hidden />
            {t("saveButton")}
          </Button>
          <p className="text-sm text-muted-foreground">{t("saveNote")}</p>
        </div>
      </FieldGroup>
    </form>
  );
}
