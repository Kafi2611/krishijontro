"use client";
// The two things a person can do under a support ticket's conversation:
//   TicketReplyForm   — write one more message ("Send")
//   CloseTicketButton — close the ticket (a box asks first, because nobody can write in it after)
// `side` says who is writing: the ticket's owner ("user") or an admin ("admin"); each side
// calls its own server action, which checks the role on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCloseTicketAction,
  adminReplyTicketAction,
  closeTicketAction,
  replyTicketAction,
} from "@/lib/actions/support";
import { replySchema, type ReplyInput } from "@/lib/validators/support";
import type { ValidationKey } from "@/lib/validators/types";

type Side = "user" | "admin";

export function TicketReplyForm({ ticketId, side }: { ticketId: string; side: Side }) {
  const t = useTranslations("Support");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  const form = useForm<ReplyInput>({ resolver: zodResolver(replySchema), defaultValues: { body: "" } });
  const bodyError = form.formState.errors.body?.message;

  /** Runs when the Zod check passed: sends the message; the page then shows it in the thread. */
  function onSubmit(values: ReplyInput) {
    startTransition(async () => {
      const result =
        side === "admin" ? await adminReplyTicketAction(ticketId, values) : await replyTicketAction(ticketId, values);
      if (result.ok) {
        form.reset({ body: "" });
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3">
      <Field data-invalid={!!bodyError}>
        <FieldLabel htmlFor={`reply-${ticketId}`}>{side === "admin" ? t("answerLabel") : t("replyLabel")}</FieldLabel>
        <Textarea id={`reply-${ticketId}`} rows={3} aria-invalid={!!bodyError} {...form.register("body")} />
        {bodyError && <FieldError>{tError(bodyError as ValidationKey)}</FieldError>}
      </Field>
      <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
        <Send aria-hidden />
        {t("send")}
      </Button>
    </form>
  );
}

export function CloseTicketButton({ ticketId, side }: { ticketId: string; side: Side }) {
  const t = useTranslations("Support");
  const tCommon = useTranslations("Common");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  /** Closes the ticket on the server. */
  function confirmClose() {
    startTransition(async () => {
      const result = side === "admin" ? await adminCloseTicketAction(ticketId) : await closeTicketAction(ticketId);
      if (result.ok) {
        toast.success(t("closed"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isPending}>
          <CircleCheck aria-hidden />
          {t("close")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("closeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("closeText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmClose}>{t("closeYes")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
