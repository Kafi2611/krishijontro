"use client";
// The government's form to create or change a subsidy program: names (English + Bangla),
// a short description, the discount %, the most land a farmer may have, the budget, the
// dates and an on/off switch. Zod (subsidyProgramSchema) checks it here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveSubsidyProgramAction } from "@/lib/actions/subsidy";
import { numberFromInput } from "@/lib/form-values";
import { useRouter } from "@/lib/navigation";
import { subsidyProgramSchema, type SubsidyProgramInput } from "@/lib/validators/subsidy";
import type { ValidationKey } from "@/lib/validators/types";

type SubsidyProgramFormProps = {
  programId: string | null; // null = a new program
  defaultValues: Partial<SubsidyProgramInput>;
};

export function SubsidyProgramForm({ programId, defaultValues }: SubsidyProgramFormProps) {
  const t = useTranslations("GovtSubsidies");
  const tError = useTranslations("Validation");
  const router = useRouter();
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<SubsidyProgramInput>({
    resolver: zodResolver(subsidyProgramSchema),
    defaultValues,
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: saves on the server, then goes back to the list. */
  function onSubmit(values: SubsidyProgramInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await saveSubsidyProgramAction(programId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(t("saved"));
      router.push("/govt/subsidies");
    });
  }

  /** The translated error under a field, if that field has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  /** A number box connected to the form (Bangla digits are allowed). */
  function numberInput(name: "discountPercent" | "maxLandDecimal" | "budget", inputMode: "numeric" | "decimal") {
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
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
            {errorText(errors.name?.message)}
          </Field>
          <Field data-invalid={!!errors.nameBn}>
            <FieldLabel htmlFor="nameBn">{t("nameBn")}</FieldLabel>
            <Input id="nameBn" lang="bn" aria-invalid={!!errors.nameBn} {...form.register("nameBn")} />
            {errorText(errors.nameBn?.message)}
          </Field>
        </div>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">{t("description")}</FieldLabel>
          <Textarea id="description" rows={2} aria-invalid={!!errors.description} {...form.register("description")} />
          {errorText(errors.description?.message)}
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field data-invalid={!!errors.discountPercent}>
            <FieldLabel htmlFor="discountPercent">{t("discountPercent")}</FieldLabel>
            {numberInput("discountPercent", "numeric")}
            <FieldDescription>{t("discountHint")}</FieldDescription>
            {errorText(errors.discountPercent?.message)}
          </Field>
          <Field data-invalid={!!errors.maxLandDecimal}>
            <FieldLabel htmlFor="maxLandDecimal">{t("maxLandDecimal")}</FieldLabel>
            {numberInput("maxLandDecimal", "decimal")}
            <FieldDescription>{t("maxLandHint")}</FieldDescription>
            {errorText(errors.maxLandDecimal?.message)}
          </Field>
          <Field data-invalid={!!errors.budget}>
            <FieldLabel htmlFor="budget">{t("budgetTk")}</FieldLabel>
            {numberInput("budget", "numeric")}
            <FieldDescription>{t("budgetHint")}</FieldDescription>
            {errorText(errors.budget?.message)}
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.startDay}>
            <FieldLabel htmlFor="startDay">{t("startDay")}</FieldLabel>
            <Input id="startDay" type="date" aria-invalid={!!errors.startDay} {...form.register("startDay")} />
            {errorText(errors.startDay?.message)}
          </Field>
          <Field data-invalid={!!errors.endDay}>
            <FieldLabel htmlFor="endDay">{t("endDay")}</FieldLabel>
            <Input id="endDay" type="date" aria-invalid={!!errors.endDay} {...form.register("endDay")} />
            {errorText(errors.endDay?.message)}
          </Field>
        </div>

        <Field orientation="horizontal">
          <input id="isActive" type="checkbox" className="size-5 accent-primary" {...form.register("isActive")} />
          <div>
            <FieldLabel htmlFor="isActive">{t("isActive")}</FieldLabel>
            <FieldDescription>{t("isActiveHint")}</FieldDescription>
          </div>
        </Field>

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <Save aria-hidden />
          {t("save")}
        </Button>
      </FieldGroup>
    </form>
  );
}
