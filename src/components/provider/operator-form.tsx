"use client";
// The provider's "Add operator" form: name, mobile number, first password,
// driving licence and years of experience. Creates the operator's login account.
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createOperatorAction } from "@/lib/actions/provider";
import { numberFromInput } from "@/lib/form-values";
import { toEnglishDigits } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";
import { operatorSchema, type OperatorInput } from "@/lib/validators/operator";
import type { ValidationKey } from "@/lib/validators/types";

export function OperatorForm() {
  const t = useTranslations("Operators");
  const tAuth = useTranslations("Auth");
  const tError = useTranslations("Validation");
  const router = useRouter();
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<OperatorInput>({
    resolver: zodResolver(operatorSchema),
    defaultValues: { name: "", phone: "", password: "", licenseNo: "", experienceYears: 0 },
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: creates the account, then goes back to the list. */
  function onSubmit(values: OperatorInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createOperatorAction(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(t("added"));
      router.push("/provider/operators");
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
          <FieldLabel htmlFor="name">{tAuth("name")}</FieldLabel>
          <Input id="name" autoComplete="off" aria-invalid={!!errors.name} {...form.register("name")} />
          {errorText(errors.name?.message)}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="phone">{tAuth("phone")}</FieldLabel>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="01XXXXXXXXX"
              autoComplete="off"
              aria-invalid={!!errors.phone}
              {...form.register("phone", { setValueAs: (value: string) => toEnglishDigits(value) })}
            />
            {errorText(errors.phone?.message)}
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">{t("firstPassword")}</FieldLabel>
            {/* type="text": the provider must SEE the password to tell it to the operator */}
            <Input id="password" type="text" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
            <FieldDescription>{t("passwordHint")}</FieldDescription>
            {errorText(errors.password?.message)}
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.licenseNo}>
            <FieldLabel htmlFor="licenseNo">
              {t("licenseNo")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </FieldLabel>
            <Input id="licenseNo" aria-invalid={!!errors.licenseNo} {...form.register("licenseNo")} />
            {errorText(errors.licenseNo?.message)}
          </Field>
          <Field data-invalid={!!errors.experienceYears}>
            <FieldLabel htmlFor="experienceYears">{t("experienceYears")}</FieldLabel>
            <Input
              id="experienceYears"
              inputMode="numeric"
              aria-invalid={!!errors.experienceYears}
              {...form.register("experienceYears", { setValueAs: numberFromInput })}
            />
            {errorText(errors.experienceYears?.message)}
          </Field>
        </div>

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <UserPlus aria-hidden />
          {t("addButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}
