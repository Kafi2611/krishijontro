"use client";
// The login form: mobile number + password.
// 1. React Hook Form keeps the typed values.
// 2. Zod (loginSchema) checks them in the browser and shows errors under the boxes.
// 3. If they look fine, we call loginAction on the server, which checks the password.
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/lib/actions/auth";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";
import { toEnglishDigits } from "@/lib/i18n";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import type { ValidationKey } from "@/lib/validators/types";

type DemoAccount = { phone: string; roleLabel: string; name: string };

type LoginFormProps = {
  callbackUrl?: string; // the page to open after login (set by proxy.ts)
  demoAccounts?: DemoAccount[]; // only given in development mode
};

export function LoginForm({ callbackUrl, demoAccounts }: LoginFormProps) {
  const t = useTranslations("Auth");
  const tError = useTranslations("Validation");
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });
  const errors = form.formState.errors;

  /** Runs only when the Zod check passed. Sends the values to the server. */
  function onSubmit(values: LoginInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(values, callbackUrl);
      // If login worked we are redirected away, so we only get here on failure.
      if (result?.error) {
        setServerError(result.error as ValidationKey);
      }
    });
  }

  /** Fills the form with a demo account (development only). */
  function fillDemoAccount(phone: string) {
    form.setValue("phone", phone);
    form.setValue("password", DEMO_PASSWORD);
    form.clearErrors();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="01XXXXXXXXX"
              aria-invalid={!!errors.phone}
              // Farmers may type Bangla digits (০১৭...). We change them to 017... before checking.
              {...form.register("phone", { setValueAs: (value: string) => toEnglishDigits(value) })}
            />
            {errors.phone && <FieldError>{tError(errors.phone.message as ValidationKey)}</FieldError>}
          </Field>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...form.register("password")}
            />
            {errors.password && (
              <FieldError>{tError(errors.password.message as ValidationKey)}</FieldError>
            )}
          </Field>

          {serverError && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {tError(serverError)}
            </p>
          )}

          <Button type="submit" size="lg" disabled={isPending} className="w-full">
            <LogIn aria-hidden />
            {t("loginButton")}
          </Button>
        </FieldGroup>
      </form>

      {demoAccounts && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="font-semibold">{t("demoTitle")}</p>
          <p className="mb-3 text-sm text-muted-foreground">{t("demoHint")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {demoAccounts.map((account) => (
              <button
                key={account.phone}
                type="button"
                onClick={() => fillDemoAccount(account.phone)}
                className="rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="block font-medium">{account.roleLabel}</span>
                <span className="text-muted-foreground">{account.phone}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
