"use client";
// The "Ask for help" form: a short subject, maybe one of the user's bookings (farmers, providers
// and operators have bookings), and the first message. Zod (newTicketSchema) checks it here and
// again on the server; the server also checks that the booking is really the user's.
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTicketAction } from "@/lib/actions/support";
import { useRouter } from "@/lib/navigation";
import { newTicketSchema, type NewTicketInput } from "@/lib/validators/support";
import type { ValidationKey } from "@/lib/validators/types";

/** "No booking" in the drop-down. (A Select item cannot have the value "".) */
const NO_BOOKING = "none";

type NewTicketFormProps = {
  bookings: { id: string; label: string }[]; // the user's latest bookings (may be empty)
  defaultBookingId: string; // "" or a booking the user came from
};

export function NewTicketForm({ bookings, defaultBookingId }: NewTicketFormProps) {
  const t = useTranslations("Support");
  const tError = useTranslations("Validation");
  const router = useRouter();
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewTicketInput>({
    resolver: zodResolver(newTicketSchema),
    defaultValues: { subject: "", bookingId: defaultBookingId, message: "" },
  });
  const errors = form.formState.errors;

  /** Runs when the Zod check passed: opens the ticket, then shows its conversation. */
  function onSubmit(values: NewTicketInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createTicketAction(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(`/support/${result.ticketId}`);
    });
  }

  /** The translated error under a field, if that field has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.subject}>
          <FieldLabel htmlFor="subject">{t("subject")}</FieldLabel>
          <Input id="subject" placeholder={t("subjectPlaceholder")} aria-invalid={!!errors.subject} {...form.register("subject")} />
          {errorText(errors.subject?.message)}
        </Field>

        {bookings.length > 0 && (
          <Field>
            <FieldLabel htmlFor="bookingId">{t("booking")}</FieldLabel>
            <Controller
              control={form.control}
              name="bookingId"
              render={({ field }) => (
                <Select
                  value={field.value === "" ? NO_BOOKING : field.value}
                  onValueChange={(value) => field.onChange(value === NO_BOOKING ? "" : value)}
                >
                  <SelectTrigger id="bookingId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BOOKING}>{t("noBooking")}</SelectItem>
                    {bookings.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        {booking.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription>{t("bookingHint")}</FieldDescription>
          </Field>
        )}

        <Field data-invalid={!!errors.message}>
          <FieldLabel htmlFor="message">{t("message")}</FieldLabel>
          <Textarea id="message" rows={4} placeholder={t("messagePlaceholder")} aria-invalid={!!errors.message} {...form.register("message")} />
          {errorText(errors.message?.message)}
        </Field>

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <Send aria-hidden />
          {t("sendTicket")}
        </Button>
      </FieldGroup>
    </form>
  );
}
