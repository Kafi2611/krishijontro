"use client";
// The admin's "Add a staff account" form: the role first (big buttons), then the name, mobile
// number and first password. An officer also needs their upazila (and may get a job title);
// a technician may get the upazila they work in and their skills.
// Zod (staffSchema) checks it here and again on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UpazilaSelect } from "@/components/upazila-select";
import { createStaffAction } from "@/lib/actions/user";
import { toEnglishDigits } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";
import type { UpazilaOption } from "@/lib/services/location";
import { STAFF_ROLES, staffSchema, type StaffInput } from "@/lib/validators/staff";
import type { ValidationKey } from "@/lib/validators/types";

export function StaffForm({ upazilas }: { upazilas: UpazilaOption[] }) {
  const t = useTranslations("StaffForm");
  const tAuth = useTranslations("Auth");
  const tRoles = useTranslations("Roles");
  const tError = useTranslations("Validation");
  const router = useRouter();
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<StaffInput>({
    resolver: zodResolver(staffSchema),
    defaultValues: { role: "OFFICER", name: "", phone: "", password: "", upazilaId: "", designation: "", skills: "" },
  });
  const errors = form.formState.errors;
  // The chosen role decides which extra boxes are shown.
  const role = useWatch({ control: form.control, name: "role" });

  /** Runs when the Zod check passed: makes the account, then goes back to the Users list. */
  function onSubmit(values: StaffInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createStaffAction(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(t("added"));
      router.push(`/admin/users?role=${values.role}`);
    });
  }

  /** The translated error under a field, if that field has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FieldSet>
          <FieldLegend>{t("role")}</FieldLegend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STAFF_ROLES.map((staffRole) => (
              <OptionCard key={staffRole} inputProps={{ value: staffRole, ...form.register("role") }}>
                {tRoles(staffRole)}
              </OptionCard>
            ))}
          </div>
          <FieldDescription>{t(`roleHints.${role}`)}</FieldDescription>
        </FieldSet>

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">{tAuth("name")}</FieldLabel>
          <Input id="name" autoComplete="off" aria-invalid={!!errors.name} {...form.register("name")} />
          {errorText(errors.name?.message)}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="phone">{tAuth("phone")}</FieldLabel>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="01XXXXXXXXX"
              autoComplete="off"
              aria-invalid={!!errors.phone}
              {...form.register("phone", { setValueAs: (value: string) => toEnglishDigits(value) })}
            />
            {errorText(errors.phone?.message)}
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">{t("firstPassword")}</FieldLabel>
            {/* type="text": the admin must SEE the password to tell it to the person */}
            <Input id="password" type="text" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
            <FieldDescription>{t("passwordHint")}</FieldDescription>
            {errorText(errors.password?.message)}
          </Field>
        </div>

        {(role === "OFFICER" || role === "TECHNICIAN") && (
          <Field data-invalid={!!errors.upazilaId}>
            <FieldLabel htmlFor="upazilaId">
              {role === "OFFICER" ? t("officerUpazila") : t("technicianUpazila")}
            </FieldLabel>
            <Controller
              control={form.control}
              name="upazilaId"
              render={({ field }) => (
                <UpazilaSelect
                  id="upazilaId"
                  value={field.value}
                  onChange={field.onChange}
                  upazilas={upazilas}
                  placeholder={t("chooseUpazila")}
                  invalid={!!errors.upazilaId}
                />
              )}
            />
            {errorText(errors.upazilaId?.message)}
          </Field>
        )}

        {role === "OFFICER" && (
          <Field data-invalid={!!errors.designation}>
            <FieldLabel htmlFor="designation">
              {t("designation")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </FieldLabel>
            <Input id="designation" placeholder={t("designationPlaceholder")} aria-invalid={!!errors.designation} {...form.register("designation")} />
            {errorText(errors.designation?.message)}
          </Field>
        )}

        {role === "TECHNICIAN" && (
          <Field data-invalid={!!errors.skills}>
            <FieldLabel htmlFor="skills">
              {t("skills")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </FieldLabel>
            <Input id="skills" placeholder={t("skillsPlaceholder")} aria-invalid={!!errors.skills} {...form.register("skills")} />
            {errorText(errors.skills?.message)}
          </Field>
        )}

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <UserPlus aria-hidden />
          {t("addButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}
