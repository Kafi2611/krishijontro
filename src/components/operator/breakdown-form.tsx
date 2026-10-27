"use client";
// The operator's "Report a breakdown" box on a job that is WORKING.
// It starts as one button, so it is not pressed by mistake. Pressed, it opens a short form:
// the work done before the breakdown, what is wrong, and (optional) one photo of the machine.
// The server then stops the job, sends the machine for repair and looks for a replacement
// (reportBreakdown in lib/services/breakdown.ts).
import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ImageUploader } from "@/components/image-uploader";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BillingUnit } from "@/generated/prisma/enums";
import { reportBreakdownAction } from "@/lib/actions/breakdown";
import { numberFromInput } from "@/lib/form-values";
import { breakdownSchema, MAX_BREAKDOWN_PHOTOS, type BreakdownInput } from "@/lib/validators/breakdown";
import type { ValidationKey } from "@/lib/validators/types";

type BreakdownFormProps = {
  bookingId: string;
  billingUnit: BillingUnit;
  bookedAmount: number; // what was booked: decimal of land (per acre) or hours / days
};

export function BreakdownForm({ bookingId, billingUnit, bookedAmount }: BreakdownFormProps) {
  const t = useTranslations("Breakdown");
  const tError = useTranslations("Validation");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<BreakdownInput>({
    resolver: zodResolver(breakdownSchema),
    defaultValues: { doneAmount: 0, description: "", photoUrls: [] },
  });
  const errors = form.formState.errors;

  /** Sends the report. The page then redraws with the breakdown box. */
  function onSubmit(values: BreakdownInput) {
    // Same rule as the server: less than what was booked (all done = press Finish instead).
    if (values.doneAmount >= bookedAmount) {
      form.setError("doneAmount", { message: "doneTooMuch" });
      return;
    }
    startTransition(async () => {
      const result = await reportBreakdownAction(bookingId, values);
      if (result.ok) {
        toast.success(t("reported"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  if (!isOpen) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("openText")}</p>
        <Button variant="outline" size="lg" className="w-full border-orange-300 text-orange-800 sm:w-auto" onClick={() => setIsOpen(true)}>
          <TriangleAlert aria-hidden />
          {t("openButton")}
        </Button>
      </div>
    );
  }

  // Land is typed in decimal (as farmers measure it); other machines in hours or days.
  let doneLabel = t("doneLand");
  if (billingUnit === "PER_HOUR") {
    doneLabel = t("doneHours");
  } else if (billingUnit === "PER_DAY") {
    doneLabel = t("doneDays");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.doneAmount}>
          <FieldLabel htmlFor="done-amount">{doneLabel}</FieldLabel>
          <Input
            id="done-amount"
            inputMode="decimal"
            className="max-w-48"
            aria-invalid={!!errors.doneAmount}
            {...form.register("doneAmount", { setValueAs: numberFromInput })}
          />
          <FieldDescription>{t("doneHelp", { booked: bookedAmount })}</FieldDescription>
          {errors.doneAmount?.message && <FieldError>{tError(errors.doneAmount.message as ValidationKey)}</FieldError>}
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="breakdown-description">{t("description")}</FieldLabel>
          <Textarea
            id="breakdown-description"
            rows={3}
            placeholder={t("descriptionPlaceholder")}
            aria-invalid={!!errors.description}
            {...form.register("description")}
          />
          {errors.description?.message && <FieldError>{tError(errors.description.message as ValidationKey)}</FieldError>}
        </Field>
        <Field>
          <FieldLabel>{t("photo")}</FieldLabel>
          {/* The photo picker is not a plain <input>, so we connect it with a Controller */}
          <Controller
            control={form.control}
            name="photoUrls"
            render={({ field }) => (
              <ImageUploader value={field.value} onChange={field.onChange} maxImages={MAX_BREAKDOWN_PHOTOS} />
            )}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="destructive" size="lg" disabled={isPending}>
            <TriangleAlert aria-hidden />
            {t("submit")}
          </Button>
          <Button type="button" variant="ghost" size="lg" disabled={isPending} onClick={() => setIsOpen(false)}>
            {t("cancel")}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
