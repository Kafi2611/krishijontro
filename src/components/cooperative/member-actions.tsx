"use client";
// The cooperative leader's member buttons:
//   AddMemberForm      — add a farmer by their mobile number (they must have a farmer account)
//   RemoveMemberButton — remove a member (a box asks first)
// Zod (addMemberSchema) checks the number here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { UserMinus, UserPlus } from "lucide-react";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addMemberAction, removeMemberAction } from "@/lib/actions/cooperative";
import { toEnglishDigits } from "@/lib/i18n";
import { addMemberSchema, type AddMemberInput } from "@/lib/validators/cooperative";
import type { ValidationKey } from "@/lib/validators/types";

export function AddMemberForm() {
  const t = useTranslations("Cooperative");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddMemberInput>({ resolver: zodResolver(addMemberSchema), defaultValues: { phone: "" } });
  const phoneError = form.formState.errors.phone?.message;

  /** Runs when the Zod check passed: adds the farmer; the list then shows them. */
  function onSubmit(values: AddMemberInput) {
    startTransition(async () => {
      const result = await addMemberAction(values);
      if (result.ok) {
        toast.success(t("memberAdded"));
        form.reset({ phone: "" });
      } else {
        form.setError("phone", { message: result.error });
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3">
      <Field data-invalid={!!phoneError}>
        <FieldLabel htmlFor="member-phone">{t("memberPhone")}</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="member-phone"
            type="tel"
            inputMode="numeric"
            placeholder="01XXXXXXXXX"
            className="h-11"
            aria-invalid={!!phoneError}
            {...form.register("phone", { setValueAs: (value: string) => toEnglishDigits(value) })}
          />
          <Button type="submit" size="lg" disabled={isPending}>
            <UserPlus aria-hidden />
            {t("addMember")}
          </Button>
        </div>
        <FieldDescription>{t("memberPhoneHint")}</FieldDescription>
        {phoneError && <FieldError>{tError(phoneError as ValidationKey)}</FieldError>}
      </Field>
    </form>
  );
}

export function RemoveMemberButton({ memberId, name }: { memberId: string; name: string }) {
  const t = useTranslations("Cooperative");
  const tCommon = useTranslations("Common");
  const tError = useTranslations("Validation");
  const [isPending, startTransition] = useTransition();

  /** Removes the member on the server. */
  function confirmRemove() {
    startTransition(async () => {
      const result = await removeMemberAction(memberId);
      if (result.ok) {
        toast.success(t("memberRemoved"));
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending}>
          <UserMinus aria-hidden />
          {t("remove")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("removeTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("removeText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmRemove}>{t("removeYes")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
