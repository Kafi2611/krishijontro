"use client";
// The provider's "Ask a technician" form on a machine's page: a service (oil, filters,
// check-up) or a repair (something is broken), and what the technician should know.
// Every technician gets a message; the provider gets one at each step of the work.
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { MaintenanceType } from "@/generated/prisma/enums";
import { requestMaintenanceAction } from "@/lib/actions/maintenance";
import { maintenanceRequestSchema, type MaintenanceRequestInput } from "@/lib/validators/maintenance";
import type { ValidationKey } from "@/lib/validators/types";

export function MaintenanceRequestForm({ machineId, serviceIsNear }: { machineId: string; serviceIsNear: boolean }) {
  const t = useTranslations("Maintenance");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();
  const form = useForm<MaintenanceRequestInput>({
    resolver: zodResolver(maintenanceRequestSchema),
    // When the service is near, the form starts with "Service" chosen.
    defaultValues: { type: serviceIsNear ? "SERVICE" : "REPAIR", description: "" },
  });
  const errors = form.formState.errors;

  function onSubmit(values: MaintenanceRequestInput) {
    startTransition(async () => {
      const result = await requestMaintenanceAction(machineId, values);
      if (result.ok) {
        toast.success(t("requested"));
        form.reset({ type: values.type, description: "" });
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <p className="text-sm text-muted-foreground">{t("requestText")}</p>
        <FieldSet>
          <FieldLegend>{t("typeLabel")}</FieldLegend>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(MaintenanceType).map((type) => (
              <OptionCard key={type} inputProps={{ value: type, ...form.register("type") }}>
                <Wrench className="size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block">{t(`types.${type}`)}</span>
                  <span className="block font-normal text-muted-foreground">{t(`typeHints.${type}`)}</span>
                </span>
              </OptionCard>
            ))}
          </div>
        </FieldSet>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="maintenance-description">{t("descriptionLabel")}</FieldLabel>
          <Textarea
            id="maintenance-description"
            rows={2}
            placeholder={t("descriptionPlaceholder")}
            aria-invalid={!!errors.description}
            {...form.register("description")}
          />
          {errors.description?.message && <FieldError>{tError(errors.description.message as ValidationKey)}</FieldError>}
        </Field>
        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <Send aria-hidden />
          {t("requestButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}
