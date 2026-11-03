"use client";
// The admin's Settings form: the platform fee, the farmer's cancellation rules and the
// emergency replacement search. Each box is a whole number inside its limits; Zod
// (settingsSchema) checks it here and again on the server before anything is saved.
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateSettingsAction } from "@/lib/actions/settings";
import { numberFromInput } from "@/lib/form-values";
import { SETTING_LIMITS, type PlatformSettingKey } from "@/lib/services/settings-rules";
import { settingsSchema, type SettingsInput } from "@/lib/validators/settings";
import type { ValidationKey } from "@/lib/validators/types";

/** The three boxes of the page, and the settings inside each one. */
const GROUPS: { titleKey: "moneyTitle" | "cancelTitle" | "breakdownTitle"; keys: PlatformSettingKey[] }[] = [
  { titleKey: "moneyTitle", keys: ["platformFeePercent"] },
  { titleKey: "cancelTitle", keys: ["freeCancellationHours", "cancellationFeePercent"] },
  { titleKey: "breakdownTitle", keys: ["replacementRadiusKm", "replacementTimeoutHours"] },
];

export function SettingsForm({ current }: { current: SettingsInput }) {
  const t = useTranslations("AdminSettings");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: current,
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: saves the new values on the server. */
  function onSubmit(values: SettingsInput) {
    startTransition(async () => {
      const result = await updateSettingsAction(values);
      if (result.ok) {
        toast.success(t("saved"));
        form.reset(values); // the saved values are the new starting point
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      {GROUPS.map((group) => (
        <Card key={group.titleKey}>
          <CardHeader>
            <CardTitle>{t(group.titleKey)}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {group.keys.map((key) => {
                const error = errors[key]?.message;
                return (
                  <Field key={key} data-invalid={!!error}>
                    <FieldLabel htmlFor={key}>{t(`fields.${key}.label`)}</FieldLabel>
                    <Input
                      id={key}
                      inputMode="numeric"
                      className="max-w-40"
                      aria-invalid={!!error}
                      {...form.register(key, { setValueAs: numberFromInput })}
                    />
                    <FieldDescription>
                      {t(`fields.${key}.hint`)} {t("range", SETTING_LIMITS[key])}
                    </FieldDescription>
                    {error && <FieldError>{tError(error as ValidationKey)}</FieldError>}
                  </Field>
                );
              })}
            </FieldGroup>
          </CardContent>
        </Card>
      ))}

      <Card className="bg-muted/40">
        <CardHeader>
          <CardDescription>{t("auditNote")}</CardDescription>
        </CardHeader>
      </Card>

      <Button type="submit" size="lg" disabled={isPending || !form.formState.isDirty} className="w-full sm:w-auto">
        <Save aria-hidden />
        {t("saveButton")}
      </Button>
    </form>
  );
}
