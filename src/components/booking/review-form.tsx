"use client";
// The farmer's review of a paid job: 1 to 5 stars for the machine and, separately, for the
// operator, each with an optional comment. Big star buttons, easy to tap on a phone.
// After sending, the booking becomes "Reviewed" and the provider's trust score is updated.
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { submitReviewAction } from "@/lib/actions/review";
import { cn } from "@/lib/utils";
import { reviewSchema, type ReviewInput } from "@/lib/validators/review";
import type { ValidationKey } from "@/lib/validators/types";

/**
 * Five star buttons. Pressing the 4th star gives 4. It works like a group of radio buttons:
 * screen readers hear "4 stars, selected".
 */
function StarInput({ value, onChange, label }: { value: number; onChange: (stars: number) => void; label: string }) {
  const t = useTranslations("Reviews");
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((stars) => (
        <button
          key={stars}
          type="button"
          role="radio"
          aria-checked={value === stars}
          aria-label={t("starButton", { count: stars })}
          onClick={() => onChange(stars)}
          className="rounded-md p-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Star
            className={cn("size-9", stars <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

type ReviewFormProps = {
  bookingId: string;
  machineName: string;
  operatorName: string;
};

export function ReviewForm({ bookingId, machineName, operatorName }: ReviewFormProps) {
  const t = useTranslations("Reviews");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();
  // 0 stars = not chosen yet (the rules then say "Please choose 1 to 5 stars").
  const form = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { machineRating: 0, machineComment: "", operatorRating: 0, operatorComment: "" },
  });
  const errors = form.formState.errors;

  function onSubmit(values: ReviewInput) {
    startTransition(async () => {
      const result = await submitReviewAction(bookingId, values);
      if (result.ok) {
        toast.success(t("sent"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  /** One part of the form: the stars and the comment for the machine, or for the operator. */
  function part(who: "machine" | "operator", title: string) {
    const ratingName = who === "machine" ? "machineRating" : "operatorRating";
    const commentName = who === "machine" ? "machineComment" : "operatorComment";
    const ratingError = errors[ratingName]?.message;
    const commentError = errors[commentName]?.message;
    return (
      <FieldSet>
        <FieldLegend>{title}</FieldLegend>
        <Controller
          control={form.control}
          name={ratingName}
          render={({ field }) => <StarInput value={field.value} onChange={field.onChange} label={title} />}
        />
        {ratingError && <FieldError>{tError(ratingError as ValidationKey)}</FieldError>}
        <Field data-invalid={!!commentError}>
          <FieldLabel htmlFor={`${who}-comment`}>{t("commentLabel")}</FieldLabel>
          <Textarea
            id={`${who}-comment`}
            rows={2}
            placeholder={who === "machine" ? t("machinePlaceholder") : t("operatorPlaceholder")}
            aria-invalid={!!commentError}
            {...form.register(commentName)}
          />
          {commentError && <FieldError>{tError(commentError as ValidationKey)}</FieldError>}
        </Field>
      </FieldSet>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <p className="text-muted-foreground">{t("formText")}</p>
        {part("machine", t("machineLabel", { machine: machineName }))}
        {part("operator", t("operatorLabel", { name: operatorName }))}
        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <Send aria-hidden />
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
