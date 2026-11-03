"use client";
// The cooperative leader's "Cooperative details" form: name, upazila, village and the
// registration number (optional). The first save makes the cooperative; later saves change it.
// Zod (cooperativeSchema) checks it here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UpazilaSelect } from "@/components/upazila-select";
import { saveCooperativeAction } from "@/lib/actions/cooperative";
import { useRouter } from "@/lib/navigation";
import type { UpazilaOption } from "@/lib/services/location";
import { cooperativeSchema, type CooperativeInput } from "@/lib/validators/cooperative";
import type { ValidationKey } from "@/lib/validators/types";

type CooperativeFormProps = {
  defaultValues: CooperativeInput;
  upazilas: UpazilaOption[];
};

export function CooperativeForm({ defaultValues, upazilas }: CooperativeFormProps) {
  const t = useTranslations("Cooperative");
  const tError = useTranslations("Validation");
  const router = useRouter();
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CooperativeInput>({ resolver: zodResolver(cooperativeSchema), defaultValues });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: saves, then goes to the cooperative's dashboard. */
  function onSubmit(values: CooperativeInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await saveCooperativeAction(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(t("saved"));
      router.push("/cooperative");
    });
  }

  /** The translated error under a field, if that field has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
          <Input id="name" placeholder={t("namePlaceholder")} aria-invalid={!!errors.name} {...form.register("name")} />
          {errorText(errors.name?.message)}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.upazilaId}>
            <FieldLabel htmlFor="upazilaId">{t("upazila")}</FieldLabel>
            <Controller
              control={form.control}
              name="upazilaId"
              render={({ field }) => (
                <UpazilaSelect
                  id="upazilaId"
                  value={field.value}
                  onChange={field.onChange}
                  upazilas={upazilas}
                  placeholder={t("chooseUpazila")}
                  invalid={!!errors.upazilaId}
                />
              )}
            />
            {errorText(errors.upazilaId?.message)}
          </Field>
          <Field data-invalid={!!errors.village}>
            <FieldLabel htmlFor="village">{t("village")}</FieldLabel>
            <Input id="village" aria-invalid={!!errors.village} {...form.register("village")} />
            {errorText(errors.village?.message)}
          </Field>
        </div>

        <Field data-invalid={!!errors.registrationNo}>
          <FieldLabel htmlFor="registrationNo">
            {t("registrationNo")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </FieldLabel>
          <Input id="registrationNo" aria-invalid={!!errors.registrationNo} {...form.register("registrationNo")} />
          {errorText(errors.registrationNo?.message)}
        </Field>

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <Save aria-hidden />
          {t("saveButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}
