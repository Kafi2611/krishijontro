"use client";
// The admin's button on one account in the Users list:
// - an active account: "Suspend" opens a small box for the reason (the user is told why)
// - a suspended account: "Activate" makes it active again at once
// Zod (userStatusSchema) checks the reason here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { UserStatus } from "@/generated/prisma/enums";
import { changeUserStatusAction } from "@/lib/actions/user";
import { userStatusSchema, type UserStatusInput } from "@/lib/validators/user";
import type { ValidationKey } from "@/lib/validators/types";

type UserStatusButtonProps = {
  userId: string;
  status: UserStatus;
};

export function UserStatusButton({ userId, status }: UserStatusButtonProps) {
  const t = useTranslations("AdminUsers");
  const tCommon = useTranslations("Common");
  const tError = useTranslations("Validation");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UserStatusInput>({
    resolver: zodResolver(userStatusSchema),
    defaultValues: { status: "SUSPENDED", reason: "" },
  });
  const reasonError = form.formState.errors.reason?.message;

  /** Sends the new status to the server and shows how it went. */
  function save(values: UserStatusInput) {
    startTransition(async () => {
      const result = await changeUserStatusAction(userId, values);
      if (result.ok) {
        toast.success(values.status === "SUSPENDED" ? t("suspended") : t("activated"));
        setIsOpen(false);
      } else {
        toast.error(tError(result.error));
      }
    });
  }

  if (status === "SUSPENDED") {
    return (
      <Button variant="outline" disabled={isPending} onClick={() => save({ status: "ACTIVE", reason: "" })}>
        <UserCheck aria-hidden />
        {t("activate")}
      </Button>
    );
  }

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <Ban aria-hidden />
        {t("suspend")}
      </Button>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(save)} noValidate className="w-full space-y-3 rounded-lg border p-3">
      <Field data-invalid={!!reasonError}>
        <FieldLabel htmlFor={`reason-${userId}`}>{t("reason")}</FieldLabel>
        <Textarea
          id={`reason-${userId}`}
          rows={2}
          placeholder={t("reasonPlaceholder")}
          aria-invalid={!!reasonError}
          {...form.register("reason")}
        />
        {reasonError && <FieldError>{tError(reasonError as ValidationKey)}</FieldError>}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={isPending}>
          <Ban aria-hidden />
          {t("confirmSuspend")}
        </Button>
        <Button type="button" variant="ghost" disabled={isPending} onClick={() => setIsOpen(false)}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
