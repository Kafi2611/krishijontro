"use client";
// The operator's big buttons on a job, one after another:
//   On the way -> Arrived -> Start (type the farmer's START code) -> Finish (type the real
//   work done and the farmer's FINISH code).
// Which one shows is decided by getOperatorNextStep() in lib/services/booking-rules.ts.
// After each step the server saves it, tells the farmer, and the page redraws with the next step.
// A wrong code is counted on the server: the page shows how many tries are left, and after
// 5 wrong codes a "the code is locked" note replaces the code box until the farmer makes a new code.
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheckBig, LockKeyhole, MapPin, Play, RefreshCw, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { BillingUnit } from "@/generated/prisma/enums";
import { finishWorkAction, markArrivedAction, startTripAction, startWorkAction } from "@/lib/actions/booking";
import { digitsFromInput, numberFromInput } from "@/lib/form-values";
import { useRouter } from "@/lib/navigation";
import { MAX_OTP_TRIES, type OperatorStep } from "@/lib/services/booking-rules";
import type { ActionResult, ValidationKey } from "@/lib/validators/types";
import {
  finishWorkSchema,
  startWorkSchema,
  type FinishWorkInput,
  type StartWorkInput,
} from "@/lib/validators/booking";

type JobActionsProps = {
  bookingId: string;
  step: OperatorStep;
  billingUnit: BillingUnit;
  bookedAmount: number; // what was booked: decimal of land (per acre) or hours / days
  otpTriesLeft: number; // how many more wrong codes may be typed; 0 = the code is locked
};

/** Under a code box, once a wrong code was typed: how many tries are left before the lock. */
function TriesLeftNote({ triesLeft }: { triesLeft: number }) {
  const t = useTranslations("OperatorJobs");
  if (triesLeft >= MAX_OTP_TRIES) {
    return null; // no wrong code yet
  }
  return (
    <p role="status" className="text-sm font-medium text-amber-800">
      {t("triesLeft", { count: triesLeft })}
    </p>
  );
}

/**
 * Shown instead of the code box when the code is locked (a wrong code was typed 5 times).
 * Only the farmer can make a new code; "I have the new code" then loads the page again,
 * and the code box comes back.
 */
function CodeLockedNote() {
  const t = useTranslations("OperatorJobs");
  const router = useRouter();
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
      <p className="flex items-center gap-2 font-semibold">
        <LockKeyhole className="size-5 shrink-0" aria-hidden />
        {t("lockedTitle")}
      </p>
      <p className="text-sm">{t("lockedText", { max: MAX_OTP_TRIES })}</p>
      <Button type="button" variant="outline" className="bg-background" onClick={() => router.refresh()}>
        <RefreshCw aria-hidden />
        {t("lockedRefresh")}
      </Button>
    </div>
  );
}

/** Gives a function that shows a green message when the step worked, or the translated error. */
function useResultToast() {
  const tError = useTranslations("Validation");
  return (result: ActionResult, successText: string) => {
    if (result.ok) {
      toast.success(successText);
    } else {
      toast.error(tError(result.error));
    }
  };
}

/** The 4-digit code box: big digits, a number keyboard on phones. */
function OtpInput({ id, invalid, ...registered }: { id: string; invalid: boolean } & React.ComponentProps<"input">) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={4}
      aria-invalid={invalid}
      className="h-14 max-w-48 text-center font-mono text-2xl tracking-[0.4em]"
      {...registered}
    />
  );
}

/** Start: the operator types the farmer's start code. */
function StartWorkForm({ bookingId, otpTriesLeft }: { bookingId: string; otpTriesLeft: number }) {
  const t = useTranslations("OperatorJobs");
  const tError = useTranslations("Validation");
  const showResult = useResultToast();
  const [isPending, startTransition] = useTransition();
  const form = useForm<StartWorkInput>({ resolver: zodResolver(startWorkSchema), defaultValues: { otp: "" } });
  const otpError = form.formState.errors.otp?.message;

  function onSubmit(values: StartWorkInput) {
    startTransition(async () => {
      showResult(await startWorkAction(bookingId, values), t("workStarted"));
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <p>{t("startText")}</p>
        <Field data-invalid={!!otpError}>
          <FieldLabel htmlFor="start-otp">{t("startCode")}</FieldLabel>
          <OtpInput id="start-otp" invalid={!!otpError} {...form.register("otp", { setValueAs: digitsFromInput })} />
          {otpError && <FieldError>{tError(otpError as ValidationKey)}</FieldError>}
          <TriesLeftNote triesLeft={otpTriesLeft} />
        </Field>
        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <Play aria-hidden />
          {t("startButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}

/** Finish: the real work done (filled in with what was booked) and the farmer's finish code. */
function FinishWorkForm({ bookingId, billingUnit, bookedAmount, otpTriesLeft }: Omit<JobActionsProps, "step">) {
  const t = useTranslations("OperatorJobs");
  const tError = useTranslations("Validation");
  const showResult = useResultToast();
  const [isPending, startTransition] = useTransition();
  const form = useForm<FinishWorkInput>({
    resolver: zodResolver(finishWorkSchema),
    defaultValues: { actualValue: bookedAmount, otp: "" },
  });
  const errors = form.formState.errors;

  // Land is typed in decimal (as farmers measure it); other machines in hours or days.
  let actualLabel = t("actualLand");
  if (billingUnit === "PER_HOUR") {
    actualLabel = t("actualHours");
  } else if (billingUnit === "PER_DAY") {
    actualLabel = t("actualDays");
  }

  function onSubmit(values: FinishWorkInput) {
    startTransition(async () => {
      showResult(await finishWorkAction(bookingId, values), t("workFinished"));
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <p>{t("finishText")}</p>
        <Field data-invalid={!!errors.actualValue}>
          <FieldLabel htmlFor="actual-value">{actualLabel}</FieldLabel>
          <Input
            id="actual-value"
            inputMode="decimal"
            className="max-w-48"
            aria-invalid={!!errors.actualValue}
            {...form.register("actualValue", { setValueAs: numberFromInput })}
          />
          {errors.actualValue?.message && <FieldError>{tError(errors.actualValue.message as ValidationKey)}</FieldError>}
        </Field>
        <Field data-invalid={!!errors.otp}>
          <FieldLabel htmlFor="finish-otp">{t("finishCode")}</FieldLabel>
          <OtpInput id="finish-otp" invalid={!!errors.otp} {...form.register("otp", { setValueAs: digitsFromInput })} />
          {errors.otp?.message && <FieldError>{tError(errors.otp.message as ValidationKey)}</FieldError>}
          <TriesLeftNote triesLeft={otpTriesLeft} />
        </Field>
        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <CircleCheckBig aria-hidden />
          {t("finishButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function JobActions({ bookingId, step, billingUnit, bookedAmount, otpTriesLeft }: JobActionsProps) {
  const t = useTranslations("OperatorJobs");
  const showResult = useResultToast();
  const [isPending, startTransition] = useTransition();

  // Both code steps stop when the code is locked: the farmer must make a new code first.
  const needsCode = step === "startWork" || step === "finishWork";
  if (needsCode && otpTriesLeft === 0) {
    return <CodeLockedNote />;
  }
  if (step === "startWork") {
    return <StartWorkForm bookingId={bookingId} otpTriesLeft={otpTriesLeft} />;
  }
  if (step === "finishWork") {
    return (
      <FinishWorkForm bookingId={bookingId} billingUnit={billingUnit} bookedAmount={bookedAmount} otpTriesLeft={otpTriesLeft} />
    );
  }

  // "On the way" and "Arrived" are one big button each.
  const isTrip = step === "startTrip";
  function press() {
    startTransition(async () => {
      if (isTrip) {
        showResult(await startTripAction(bookingId), t("tripStarted"));
      } else {
        showResult(await markArrivedAction(bookingId), t("arrived"));
      }
    });
  }

  return (
    <div className="space-y-3">
      <p>{isTrip ? t("startTripText") : t("arriveText")}</p>
      <Button size="lg" disabled={isPending} onClick={press} className="h-14 w-full text-base sm:w-auto">
        {isTrip ? <Truck aria-hidden /> : <MapPin aria-hidden />}
        {isTrip ? t("startTripButton") : t("arriveButton")}
      </Button>
    </div>
  );
}
