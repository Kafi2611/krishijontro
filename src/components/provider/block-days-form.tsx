"use client";
// The "Block days" form under the calendar: from date, to date and a reason.
// After saving, the page redraws itself and the new days turn red.
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addAvailabilityBlockAction } from "@/lib/actions/availability";
import {
  availabilityBlockSchema,
  type AvailabilityBlockInput,
} from "@/lib/validators/availability";
import type { ValidationKey } from "@/lib/validators/types";

type BlockDaysFormProps = {
  machineId: string;
  today: string; // "YYYY-MM-DD": the date boxes do not allow earlier days
  startDay?: string; // the day tapped on the calendar, if any
};

export function BlockDaysForm({ machineId, today, startDay }: BlockDaysFormProps) {
  const t = useTranslations("Calendar");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  const firstDay = startDay ?? today;
  const form = useForm<AvailabilityBlockInput>({
    resolver: zodResolver(availabilityBlockSchema),
    defaultValues: { fromDay: firstDay, toDay: firstDay, reason: "" },
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: saves the block on the server. */
  function onSubmit(values: AvailabilityBlockInput) {
    startTransition(async () => {
      const result = await addAvailabilityBlockAction(machineId, values);
      if (result.ok) {
        toast.success(t("blocked"));
        form.reset({ fromDay: today, toDay: today, reason: "" });
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.fromDay}>
            <FieldLabel htmlFor="fromDay">{t("from")}</FieldLabel>
            <Input id="fromDay" type="date" min={today} {...form.register("fromDay")} />
            {errors.fromDay && <FieldError>{tError(errors.fromDay.message as ValidationKey)}</FieldError>}
          </Field>
          <Field data-invalid={!!errors.toDay}>
            <FieldLabel htmlFor="toDay">{t("to")}</FieldLabel>
            <Input id="toDay" type="date" min={today} {...form.register("toDay")} />
            {errors.toDay && <FieldError>{tError(errors.toDay.message as ValidationKey)}</FieldError>}
          </Field>
        </div>
        <Field data-invalid={!!errors.reason}>
          <FieldLabel htmlFor="reason">{t("reason")}</FieldLabel>
          <Input id="reason" placeholder={t("reasonPlaceholder")} {...form.register("reason")} />
          {errors.reason && <FieldError>{tError(errors.reason.message as ValidationKey)}</FieldError>}
        </Field>
        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <CalendarX aria-hidden />
          {t("blockButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}
