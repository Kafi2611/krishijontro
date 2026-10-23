"use client";
// The farmer's "NID and land" form on the subsidy page: National ID number, all the land
// they farm (in decimal, bigha or acre), village and upazila. Saving sends it to the
// agriculture officer of that upazila, who checks it (lib/services/verification.ts).
// Zod (farmerDetailsSchema) checks it here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
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
import { saveFarmerDetailsAction } from "@/lib/actions/verification";
import { numberFromInput } from "@/lib/form-values";
import { toEnglishDigits } from "@/lib/i18n";
import { LAND_UNITS } from "@/lib/services/geo";
import type { UpazilaOption } from "@/lib/services/location";
import type { ValidationKey } from "@/lib/validators/types";
import { farmerDetailsSchema, type FarmerDetailsInput } from "@/lib/validators/verification";

type FarmerDetailsFormProps = {
  defaultValues: Partial<FarmerDetailsInput>;
  upazilas: UpazilaOption[];
};

export function FarmerDetailsForm({ defaultValues, upazilas }: FarmerDetailsFormProps) {
  const t = useTranslations("FarmerSubsidy");
  const tError = useTranslations("Validation");
  const tUnit = useTranslations("LandUnits");
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FarmerDetailsInput>({
    resolver: zodResolver(farmerDetailsSchema),
    defaultValues,
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: saves on the server. The page then shows "waiting". */
  function onSubmit(values: FarmerDetailsInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await saveFarmerDetailsAction(values);
      if (result.ok) {
        toast.success(t("sent"));
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

        <FieldSet>
          <FieldLegend variant="label">{t("land")}</FieldLegend>
          <div className="space-y-2">
            <Input
              aria-label={t("land")}
              inputMode="decimal"
              aria-invalid={!!errors.landValue}
              {...form.register("landValue", { setValueAs: numberFromInput })}
            />
            <div className="grid grid-cols-3 gap-2">
              {LAND_UNITS.map((unit) => (
                <OptionCard key={unit} className="justify-center px-2" inputProps={{ value: unit, ...form.register("landUnit") }}>
                  {tUnit(unit)}
                </OptionCard>
              ))}
            </div>
          </div>
          <FieldDescription>{t("landHint")}</FieldDescription>
          {errorText(errors.landValue?.message)}
        </FieldSet>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.village}>
            <FieldLabel htmlFor="village">{t("village")}</FieldLabel>
            <Input id="village" aria-invalid={!!errors.village} {...form.register("village")} />
            {errorText(errors.village?.message)}
          </Field>
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
        </div>

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <Send aria-hidden />
          {t("send")}
        </Button>
      </FieldGroup>
    </form>
  );
}
