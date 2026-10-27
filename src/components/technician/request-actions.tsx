"use client";
// The technician's buttons on a repair or service request, one step at a time:
//   Take this job -> Start inspecting -> Start repairing -> Fixed (parts, cost and a note).
// Which one shows is decided by getTechnicianStep() in lib/services/maintenance-rules.ts.
// After each step the server saves it and tells the provider; the page redraws with the next step.
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheckBig, Hammer, Hand, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { advanceRequestAction, finishRequestAction, takeRequestAction } from "@/lib/actions/maintenance";
import { numberFromInput } from "@/lib/form-values";
import type { TechnicianStep } from "@/lib/services/maintenance-rules";
import { finishRepairSchema, type FinishRepairInput } from "@/lib/validators/maintenance";
import type { ActionResult, ValidationKey } from "@/lib/validators/types";

/** Gives a function that shows a green message when the step worked, or the translated error. */
function useResultToast() {
  const tError = useTranslations("Validation");
  return (result: ActionResult, successText: string) => {
    if (result.ok) {
      toast.success(successText);
    } else {
      toast.error(tError(result.error));
    }
  };
}

/** The "Fixed" form: parts used, their cost, the labour cost and a note for the provider. */
function FinishRepairForm({ requestId }: { requestId: string }) {
  const t = useTranslations("Technician");
  const tError = useTranslations("Validation");
  const showResult = useResultToast();
  const [isPending, startTransition] = useTransition();
  const form = useForm<FinishRepairInput>({
    resolver: zodResolver(finishRepairSchema),
    defaultValues: { partsUsed: "", partsCost: 0, labourCost: 0, technicianNote: "" },
  });
  const errors = form.formState.errors;

  /** Shows the translated message of a field's error, if it has one. */
  function errorOf(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  function onSubmit(values: FinishRepairInput) {
    startTransition(async () => {
      showResult(await finishRequestAction(requestId, values), t("finished"));
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <p>{t("finishText")}</p>
        <Field data-invalid={!!errors.partsUsed}>
          <FieldLabel htmlFor="parts-used">{t("partsUsed")}</FieldLabel>
          <Input id="parts-used" placeholder={t("partsPlaceholder")} aria-invalid={!!errors.partsUsed} {...form.register("partsUsed")} />
          {errorOf(errors.partsUsed?.message)}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.partsCost}>
            <FieldLabel htmlFor="parts-cost">{t("partsCost")}</FieldLabel>
            <Input
              id="parts-cost"
              inputMode="numeric"
              aria-invalid={!!errors.partsCost}
              {...form.register("partsCost", { setValueAs: numberFromInput })}
            />
            {errorOf(errors.partsCost?.message)}
          </Field>
          <Field data-invalid={!!errors.labourCost}>
            <FieldLabel htmlFor="labour-cost">{t("labourCost")}</FieldLabel>
            <Input
              id="labour-cost"
              inputMode="numeric"
              aria-invalid={!!errors.labourCost}
              {...form.register("labourCost", { setValueAs: numberFromInput })}
            />
            {errorOf(errors.labourCost?.message)}
          </Field>
        </div>
        <Field data-invalid={!!errors.technicianNote}>
          <FieldLabel htmlFor="technician-note">{t("technicianNote")}</FieldLabel>
          <Textarea
            id="technician-note"
            rows={2}
            placeholder={t("notePlaceholder")}
            aria-invalid={!!errors.technicianNote}
            {...form.register("technicianNote")}
          />
          {errorOf(errors.technicianNote?.message)}
        </Field>
        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <CircleCheckBig aria-hidden />
          {t("finishButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function RequestActions({ requestId, step }: { requestId: string; step: TechnicianStep }) {
  const t = useTranslations("Technician");
  const showResult = useResultToast();
  const [isPending, startTransition] = useTransition();

  if (step === "finish") {
    return <FinishRepairForm requestId={requestId} />;
  }

  // "Take this job", "Start inspecting" and "Start repairing" are one big button each.
  const buttons = {
    take: { text: t("takeText"), label: t("takeButton"), icon: <Hand aria-hidden /> },
    inspect: { text: t("inspectText"), label: t("inspectButton"), icon: <Search aria-hidden /> },
    repair: { text: t("repairText"), label: t("repairButton"), icon: <Hammer aria-hidden /> },
  };
  const button = buttons[step];

  function press() {
    startTransition(async () => {
      if (step === "take") {
        showResult(await takeRequestAction(requestId), t("taken"));
      } else {
        showResult(await advanceRequestAction(requestId), t("advanced"));
      }
    });
  }

  return (
    <div className="space-y-3">
      <p>{button.text}</p>
      <Button size="lg" disabled={isPending} onClick={press} className="h-14 w-full text-base sm:w-auto">
        {button.icon}
        {button.label}
      </Button>
    </div>
  );
}
