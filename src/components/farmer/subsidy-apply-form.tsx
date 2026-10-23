"use client";
// The farmer's "Apply" box under one subsidy program: an optional message for the officer
// and the Apply button. The server checks the rules again (getApplyProblem in subsidy.ts).
import { zodResolver } from "@hookform/resolvers/zod";
import { FileCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { applyForSubsidyAction } from "@/lib/actions/subsidy";
import { subsidyApplicationSchema, type SubsidyApplicationInput } from "@/lib/validators/subsidy";
import type { ValidationKey } from "@/lib/validators/types";

type SubsidyApplyFormProps = {
  programId: string;
  applyAgain: boolean; // true after a rejection (the button then says "Apply again")
};

export function SubsidyApplyForm({ programId, applyAgain }: SubsidyApplyFormProps) {
  const t = useTranslations("FarmerSubsidy");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  const form = useForm<SubsidyApplicationInput>({
    resolver: zodResolver(subsidyApplicationSchema),
    defaultValues: { note: "" },
  });
  const error = form.formState.errors.note;

  /** Runs when the Zod check passed: sends the application. The page then shows "Pending". */
  function onSubmit(values: SubsidyApplicationInput) {
    startTransition(async () => {
      const result = await applyForSubsidyAction(programId, values);
      if (result.ok) {
        toast.success(t("applied"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3">
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor={`note-${programId}`}>{t("noteLabel")}</FieldLabel>
        <Textarea
          id={`note-${programId}`}
          rows={2}
          placeholder={t("notePlaceholder")}
          aria-invalid={!!error}
          {...form.register("note")}
        />
        {error?.message && <FieldError>{tError(error.message as ValidationKey)}</FieldError>}
      </Field>
      <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
        <FileCheck aria-hidden />
        {applyAgain ? t("applyAgain") : t("apply")}
      </Button>
    </form>
  );
}
