"use client";
// The provider's "Business details" form: type, business name, NID, trade licence,
// address, upazila and payout account. The admin reads these before approving.
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { OptionCard } from "@/components/option-card";
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
import { UpazilaSelect } from "@/components/upazila-select";
import { ProviderType } from "@/generated/prisma/enums";
import { updateProviderBusinessAction } from "@/lib/actions/provider";
import { toEnglishDigits } from "@/lib/i18n";
import type { UpazilaOption } from "@/lib/services/location";
import { providerBusinessSchema, type ProviderBusinessInput } from "@/lib/validators/provider";
import type { ValidationKey } from "@/lib/validators/types";

type BusinessFormProps = {
  defaultValues: ProviderBusinessInput;
  upazilas: UpazilaOption[];
};

export function BusinessForm({ defaultValues, upazilas }: BusinessFormProps) {
  const t = useTranslations("Business");
  const tCommon = useTranslations("Common");
  const tError = useTranslations("Validation");
  const tProviderTypes = useTranslations("ProviderTypes");
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProviderBusinessInput>({
    resolver: zodResolver(providerBusinessSchema),
    defaultValues,
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: saves on the server. The page then shows the new status. */
  function onSubmit(values: ProviderBusinessInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateProviderBusinessAction(values);
      if (result.ok) {
        toast.success(tCommon("saved"));
      } else {
        setServerError(result.error);
      }
    });
  }

  /** The translated error under a field, if that field has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">{t("providerType")}</FieldLegend>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(ProviderType).map((type) => (
              <OptionCard
                key={type}
                className="justify-center"
                inputProps={{ value: type, ...form.register("providerType") }}
              >
                {tProviderTypes(type)}
              </OptionCard>
            ))}
          </div>
        </FieldSet>

        <Field data-invalid={!!errors.businessName}>
          <FieldLabel htmlFor="businessName">{t("businessName")}</FieldLabel>
          <Input id="businessName" placeholder={t("businessNamePlaceholder")} aria-invalid={!!errors.businessName} {...form.register("businessName")} />
          {errorText(errors.businessName?.message)}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.nid}>
            <FieldLabel htmlFor="nid">{t("nid")}</FieldLabel>
            <Input
              id="nid"
              inputMode="numeric"
              aria-invalid={!!errors.nid}
              // Bangla digits typed on a Bangla keyboard are changed to English digits
              {...form.register("nid", { setValueAs: (value: string) => toEnglishDigits(value) })}
            />
            <FieldDescription>{t("nidHint")}</FieldDescription>
            {errorText(errors.nid?.message)}
          </Field>
          <Field data-invalid={!!errors.tradeLicenseNo}>
            <FieldLabel htmlFor="tradeLicenseNo">
              {t("tradeLicenseNo")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </FieldLabel>
            <Input id="tradeLicenseNo" aria-invalid={!!errors.tradeLicenseNo} {...form.register("tradeLicenseNo")} />
            {errorText(errors.tradeLicenseNo?.message)}
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.locationId}>
            <FieldLabel htmlFor="locationId">{t("upazila")}</FieldLabel>
            <Controller
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <UpazilaSelect
                  id="locationId"
                  value={field.value}
                  onChange={field.onChange}
                  upazilas={upazilas}
                  placeholder={t("chooseUpazila")}
                  invalid={!!errors.locationId}
                />
              )}
            />
            {errorText(errors.locationId?.message)}
          </Field>
          <Field data-invalid={!!errors.address}>
            <FieldLabel htmlFor="address">{t("address")}</FieldLabel>
            <Input id="address" placeholder={t("addressPlaceholder")} aria-invalid={!!errors.address} {...form.register("address")} />
            {errorText(errors.address?.message)}
          </Field>
        </div>

        <Field data-invalid={!!errors.payoutAccount}>
          <FieldLabel htmlFor="payoutAccount">{t("payoutAccount")}</FieldLabel>
          <Input id="payoutAccount" placeholder="bKash 017XXXXXXXX" aria-invalid={!!errors.payoutAccount} {...form.register("payoutAccount")} />
          <FieldDescription>{t("payoutHint")}</FieldDescription>
          {errorText(errors.payoutAccount?.message)}
        </Field>

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <Save aria-hidden />
          {tCommon("save")}
        </Button>
      </FieldGroup>
    </form>
  );
}
