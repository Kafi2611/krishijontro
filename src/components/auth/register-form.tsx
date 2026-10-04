"use client";
// The register form. A person chooses "Farmer" or "Machine provider", fills in
// name, mobile number and password, and gets an account (then is logged in at once).
// The same Zod rules (registerSchema) are checked here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { Tractor, UserPlus, Wheat } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { registerAction } from "@/lib/actions/auth";
import { toEnglishDigits } from "@/lib/i18n";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import type { ValidationKey } from "@/lib/validators/types";

// The two kinds of account a person can make by themselves.
const ROLE_OPTIONS = [
  { value: "FARMER", titleKey: "farmerOption", textKey: "farmerOptionText", Icon: Wheat },
  { value: "PROVIDER", titleKey: "providerOption", textKey: "providerOptionText", Icon: Tractor },
] as const;

const PROVIDER_TYPES = ["INDIVIDUAL", "COOPERATIVE", "COMPANY"] as const;

export function RegisterForm() {
  const t = useTranslations("Auth");
  const tError = useTranslations("Validation");
  const tProviderTypes = useTranslations("ProviderTypes");
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      phone: "",
      password: "",
      confirmPassword: "",
      role: "FARMER",
      providerType: "INDIVIDUAL",
    },
  });
  const errors = form.formState.errors;

  // Watch the chosen role, so we can show "provider type" only for providers.
  const selectedRole = useWatch({ control: form.control, name: "role" });

  /** Runs only when the Zod check passed. Sends the values to the server. */
  function onSubmit(values: RegisterInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await registerAction(values);
      // On success we are redirected to the dashboard, so we only get here on failure.
      if (result?.error) {
        setServerError(result.error as ValidationKey);
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {/* Role: two big cards. Each is a normal radio button, hidden, inside a label. */}
        <FieldSet>
          <FieldLegend>{t("roleLabel")}</FieldLegend>
          <div className="grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors has-checked:border-primary has-checked:bg-accent"
              >
                <input
                  type="radio"
                  value={option.value}
                  className="sr-only"
                  {...form.register("role")}
                />
                <option.Icon className="size-8 text-primary" aria-hidden />
                <span className="font-semibold">{t(option.titleKey)}</span>
                <span className="text-xs text-muted-foreground">{t(option.textKey)}</span>
              </label>
            ))}
          </div>
        </FieldSet>

        {selectedRole === "PROVIDER" && (
          <FieldSet>
            <FieldLegend variant="label">{t("providerType")}</FieldLegend>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDER_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium has-checked:border-primary has-checked:bg-accent"
                >
                  <input type="radio" value={type} className="sr-only" {...form.register("providerType")} />
                  {tProviderTypes(type)}
                </label>
              ))}
            </div>
            <FieldDescription>{t("providerNote")}</FieldDescription>
          </FieldSet>
        )}

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...form.register("name")} />
          {errors.name && <FieldError>{tError(errors.name.message as ValidationKey)}</FieldError>}
        </Field>

        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            aria-invalid={!!errors.phone}
            {...form.register("phone", { setValueAs: (value: string) => toEnglishDigits(value) })}
          />
          {errors.phone && <FieldError>{tError(errors.phone.message as ValidationKey)}</FieldError>}
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          {errors.password && (
            <FieldError>{tError(errors.password.message as ValidationKey)}</FieldError>
          )}
        </Field>

        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">{t("confirmPassword")}</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...form.register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <FieldError>{tError(errors.confirmPassword.message as ValidationKey)}</FieldError>
          )}
        </Field>

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          <UserPlus aria-hidden />
          {t("registerButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}
