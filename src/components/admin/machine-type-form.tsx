"use client";
// The admin's form to add a new machine type or edit one (name in English and
// Bangla, category, the work it can do, how rent is counted, and its icon).
// Zod (machineTypeSchema) checks it here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BillingUnit, MachineCategory, WorkType } from "@/generated/prisma/enums";
import { createMachineTypeAction, updateMachineTypeAction } from "@/lib/actions/machine-type";
import { useRouter } from "@/lib/navigation";
import {
  MACHINE_ICON_NAMES,
  machineTypeSchema,
  type MachineTypeInput,
} from "@/lib/validators/machine-type";
import type { ValidationKey } from "@/lib/validators/types";

type MachineTypeFormProps = {
  machineTypeId?: string; // given when editing; empty when adding a new type
  defaultValues: MachineTypeInput;
};

export function MachineTypeForm({ machineTypeId, defaultValues }: MachineTypeFormProps) {
  const t = useTranslations("MachineTypesAdmin");
  const tCommon = useTranslations("Common");
  const tError = useTranslations("Validation");
  const tCategory = useTranslations("MachineCategories");
  const tWork = useTranslations("WorkTypes");
  const tUnit = useTranslations("BillingUnits");
  const router = useRouter();
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<MachineTypeInput>({
    resolver: zodResolver(machineTypeSchema),
    defaultValues,
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: saves on the server, then goes back to the list. */
  function onSubmit(values: MachineTypeInput) {
    setServerError(null);
    startTransition(async () => {
      const result = machineTypeId
        ? await updateMachineTypeAction(machineTypeId, values)
        : await createMachineTypeAction(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(tCommon("saved"));
      router.push("/admin/machine-types");
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">{t("nameEn")}</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
            {errors.name && <FieldError>{tError(errors.name.message as ValidationKey)}</FieldError>}
          </Field>

          <Field data-invalid={!!errors.nameBn}>
            <FieldLabel htmlFor="nameBn">{t("nameBn")}</FieldLabel>
            <Input id="nameBn" lang="bn" aria-invalid={!!errors.nameBn} {...form.register("nameBn")} />
            {errors.nameBn && (
              <FieldError>{tError(errors.nameBn.message as ValidationKey)}</FieldError>
            )}
          </Field>
        </div>

        <FieldSet>
          <FieldLegend variant="label">{t("category")}</FieldLegend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.values(MachineCategory).map((category) => (
              <OptionCard key={category} inputProps={{ value: category, ...form.register("category") }}>
                {tCategory(category)}
              </OptionCard>
            ))}
          </div>
          {errors.category && (
            <FieldError>{tError(errors.category.message as ValidationKey)}</FieldError>
          )}
        </FieldSet>

        {/* Checkboxes with the same name: React Hook Form collects the ticked ones into an array */}
        <FieldSet>
          <FieldLegend variant="label">{t("workTypes")}</FieldLegend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.values(WorkType).map((workType) => (
              <OptionCard
                key={workType}
                type="checkbox"
                inputProps={{ value: workType, ...form.register("workTypes") }}
              >
                {tWork(workType)}
              </OptionCard>
            ))}
          </div>
          {errors.workTypes && (
            <FieldError>{tError(errors.workTypes.message as ValidationKey)}</FieldError>
          )}
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">{t("billingUnit")}</FieldLegend>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(BillingUnit).map((unit) => (
              <OptionCard
                key={unit}
                className="justify-center"
                inputProps={{ value: unit, ...form.register("billingUnit") }}
              >
                {tUnit(unit)}
              </OptionCard>
            ))}
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">{t("icon")}</FieldLegend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {MACHINE_ICON_NAMES.map((iconName) => (
              <OptionCard
                key={iconName}
                className="h-14 justify-center"
                inputProps={{ value: iconName, "aria-label": iconName, ...form.register("icon") }}
              >
                <MachineTypeIcon icon={iconName} className="size-7 text-primary" />
              </OptionCard>
            ))}
          </div>
        </FieldSet>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3">
          <input type="checkbox" className="size-5 accent-primary" {...form.register("isActive")} />
          <span className="font-medium">{t("isActive")}</span>
        </label>

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
