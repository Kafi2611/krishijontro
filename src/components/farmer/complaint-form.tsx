"use client";
// The farmer's "Report a problem" box on a finished booking (work done, or paid).
// Closed it is one button; opened, the farmer picks a reason (big buttons) and writes what
// happened. Sent, the booking becomes "Complaint made" and an admin decides.
// Before paying, the payment waits until the admin has decided (the bill may get lower).
// Zod (complaintSchema) checks it here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquareWarning, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { raiseDisputeAction } from "@/lib/actions/dispute";
import { DISPUTE_REASONS } from "@/lib/services/dispute-rules";
import { complaintSchema, type ComplaintInput } from "@/lib/validators/dispute";
import type { ValidationKey } from "@/lib/validators/types";

type ComplaintFormProps = {
  bookingId: string;
  isPaid: boolean; // the text is a little different before and after paying
};

export function ComplaintForm({ bookingId, isPaid }: ComplaintFormProps) {
  const t = useTranslations("Disputes");
  const tCommon = useTranslations("Common");
  const tError = useTranslations("Validation");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ComplaintInput>({
    resolver: zodResolver(complaintSchema),
    defaultValues: { description: "" },
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: sends the complaint. The page then shows it. */
  function onSubmit(values: ComplaintInput) {
    startTransition(async () => {
      const result = await raiseDisputeAction(bookingId, values);
      if (result.ok) {
        toast.success(t("sent"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareWarning className="size-5 text-amber-700" aria-hidden />
          {t("formTitle")}
        </CardTitle>
        <CardDescription>{isPaid ? t("formTextPaid") : t("formTextUnpaid")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!isOpen ? (
          <Button variant="outline" size="lg" onClick={() => setIsOpen(true)}>
            <MessageSquareWarning aria-hidden />
            {t("openForm")}
          </Button>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <FieldSet data-invalid={!!errors.reason}>
                <FieldLegend>{t("reasonLabel")}</FieldLegend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DISPUTE_REASONS.map((reason) => (
                    <OptionCard key={reason} inputProps={{ value: reason, ...form.register("reason") }}>
                      {t(`reasons.${reason}`)}
                    </OptionCard>
                  ))}
                </div>
                {errors.reason?.message && <FieldError>{tError(errors.reason.message as ValidationKey)}</FieldError>}
              </FieldSet>

              <Field data-invalid={!!errors.description}>
                <FieldLabel htmlFor={`complaint-${bookingId}`}>{t("descriptionLabel")}</FieldLabel>
                <Textarea
                  id={`complaint-${bookingId}`}
                  rows={3}
                  placeholder={t("descriptionPlaceholder")}
                  aria-invalid={!!errors.description}
                  {...form.register("description")}
                />
                {errors.description?.message && (
                  <FieldError>{tError(errors.description.message as ValidationKey)}</FieldError>
                )}
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="lg" disabled={isPending}>
                  <Send aria-hidden />
                  {t("send")}
                </Button>
                <Button type="button" variant="ghost" size="lg" disabled={isPending} onClick={() => setIsOpen(false)}>
                  {tCommon("cancel")}
                </Button>
              </div>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
