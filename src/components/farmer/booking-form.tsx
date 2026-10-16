"use client";
// The farmer's 3-step booking form:
//   1. Your job      — the work, the land size (or hours / days) and where the field is
//   2. Day and time  — the day and a start time; times the machine is busy are crossed out
//   3. Check and book — a summary, a message for the provider, and "Book now"
// The price card changes live while the farmer types: the browser runs the same estimateJob()
// (pricing.ts) that the server uses when it saves the booking. "Next" only checks the boxes of
// the current step; "Book now" sends everything to the server, which checks it all again.
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CalendarCheck, Check } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { BookingFacts } from "@/components/booking/booking-facts";
import { MapPicker } from "@/components/map/map-picker";
import { OptionCard } from "@/components/option-card";
import { PriceBreakdown } from "@/components/price-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UpazilaSelect } from "@/components/upazila-select";
import { WorkTypeIcon } from "@/components/work-type-icon";
import { createBookingAction } from "@/lib/actions/booking";
import { numberFromInput } from "@/lib/form-values";
import { useRouter } from "@/lib/navigation";
import type { BookingFormMachine } from "@/lib/services/booking-queries";
import { estimateWorkHours, getJobStartAt, getJobTimeRange, START_HOURS } from "@/lib/services/booking-rules";
import { addDays, DAY_REGEX, rangesOverlap, startOfDhakaDay, type TimeRange } from "@/lib/services/calendar";
import { LAND_UNITS, toDecimal, type LatLng } from "@/lib/services/geo";
import type { UpazilaOption } from "@/lib/services/location";
import { estimateJob } from "@/lib/services/pricing";
import type { PricedMachineType } from "@/lib/services/pricing-rule";
import { cn } from "@/lib/utils";
import { bookingSchema, type BookingInput } from "@/lib/validators/booking";
import { MAX_DAYS_AHEAD } from "@/lib/validators/search";
import type { ValidationKey } from "@/lib/validators/types";

type BookingFormProps = {
  machine: BookingFormMachine;
  pricedType: PricedMachineType; // today's government price rule for this machine type
  subsidyPercent: number; // the farmer's subsidy, 0 if none
  platformFeePercent: number;
  busyTimes: TimeRange[]; // when the machine is already booked or blocked
  upazilas: UpazilaOption[]; // for "go to upazila" above the map
  defaultValues: BookingInput;
  today: string; // "YYYY-MM-DD"
};

/** The title of each step, and the boxes "Next" checks before going on. */
const STEPS: { titleKey: "stepJob" | "stepTime" | "stepConfirm"; fields: (keyof BookingInput)[] }[] = [
  { titleKey: "stepJob", fields: ["workType", "landValue", "landUnit", "hoursOrDays", "lat", "lng", "fieldAddress"] },
  { titleKey: "stepTime", fields: ["day", "startHour"] },
  { titleKey: "stepConfirm", fields: ["note"] },
];
const LAST_STEP = STEPS.length - 1;

export function BookingForm({
  machine,
  pricedType,
  subsidyPercent,
  platformFeePercent,
  busyTimes,
  upazilas,
  defaultValues,
  today,
}: BookingFormProps) {
  const t = useTranslations("Booking");
  const tSearch = useTranslations("Search");
  const tWork = useTranslations("WorkTypes");
  const tUnit = useTranslations("LandUnits");
  const tError = useTranslations("Validation");
  const format = useFormatter(); // Bangla digits and day names on Bangla pages
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [jumpUpazilaId, setJumpUpazilaId] = useState("");

  const form = useForm<BookingInput>({ resolver: zodResolver(bookingSchema), defaultValues });
  const errors = form.formState.errors;

  // Watch the values the price, the time and the summary depend on.
  const [landValue, landUnit, hoursOrDays, lat, lng, day, startHour, workType, fieldAddress] = useWatch({
    control: form.control,
    name: ["landValue", "landUnit", "hoursOrDays", "lat", "lng", "day", "startHour", "workType", "fieldAddress"],
  });
  const field: LatLng = { lat, lng };
  const billingUnit = pricedType.billingUnit;

  // ── The live price ──
  const landDecimal = toDecimal(landValue, landUnit);
  const jobIsComplete = landValue > 0 && (billingUnit === "PER_ACRE" || hoursOrDays > 0);
  const estimate = estimateJob(machine, pricedType, { landDecimal, hoursOrDays, field }, subsidyPercent, platformFeePercent);

  // ── The time of the job, and whether the machine is free then ──
  const dayIsValid = DAY_REGEX.test(day);

  /** True if a job starting at `hour` on the chosen day would overlap a busy time of the machine. */
  function isTaken(hour: number): boolean {
    if (!dayIsValid) {
      return false;
    }
    const job = getJobTimeRange(day, hour, billingUnit, estimate.quantity);
    return busyTimes.some((busy) => rangesOverlap(job.startAt, job.endAt, busy.startAt, busy.endAt));
  }

  const chosenTimeTaken = isTaken(startHour);
  const jobTime = dayIsValid ? getJobTimeRange(day, startHour, billingUnit, estimate.quantity) : null;
  const dayStart = dayIsValid ? startOfDhakaDay(day) : null;
  const dayEnd = dayIsValid ? startOfDhakaDay(addDays(day, 1)) : null;
  const busyThatDay =
    dayStart && dayEnd ? busyTimes.filter((busy) => rangesOverlap(dayStart, dayEnd, busy.startAt, busy.endAt)) : [];

  const timeText = (date: Date) => format.dateTime(date, { hour: "numeric", minute: "2-digit" });
  const dayTimeText = (date: Date) => format.dateTime(date, { weekday: "short", hour: "numeric", minute: "2-digit" });

  /** A busy time on the chosen day as text: "9:00 AM – 11:00 AM", or "All day". */
  function busyText(busy: TimeRange): string {
    if (dayStart && dayEnd && busy.startAt <= dayStart && busy.endAt >= dayEnd) {
      return t("busyAllDay");
    }
    return `${timeText(busy.startAt)} – ${timeText(busy.endAt)}`;
  }

  /** Saves the map point into the form (both lat and lng) and re-checks it. */
  function setPoint(point: LatLng) {
    form.setValue("lat", point.lat, { shouldValidate: true });
    form.setValue("lng", point.lng, { shouldValidate: true });
  }

  /** "Go to upazila": moves the pin to that upazila's centre; the farmer then taps the exact field. */
  function jumpToUpazila(upazilaId: string) {
    setJumpUpazilaId(upazilaId);
    const upazila = upazilas.find((item) => item.id === upazilaId);
    if (upazila?.lat != null && upazila.lng != null) {
      setPoint({ lat: upazila.lat, lng: upazila.lng });
    }
  }

  /** "Next": checks this step's boxes (and that the time is free), then shows the next step. */
  async function goToNextStep() {
    const stepIsValid = await form.trigger(STEPS[step].fields);
    if (!stepIsValid || (step === 1 && chosenTimeTaken)) {
      return;
    }
    setStep(step + 1);
  }

  /** Runs when "Book now" is pressed and the whole form passed the Zod check. */
  function onSubmit(values: BookingInput) {
    startTransition(async () => {
      const result = await createBookingAction(values);
      if (result.ok) {
        toast.success(t("booked"));
        router.push(`/farmer/bookings/${result.bookingId}`);
        return;
      }
      toast.error(tError(result.error));
      // Someone else took this time a moment ago: go back to the time step to choose another.
      if (result.error === "timeTaken" || result.error === "machineBlocked") {
        setStep(1);
      }
    });
  }

  /** The Enter key or the main button: the next step, or "Book now" on the last step. */
  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < LAST_STEP) {
      void goToNextStep();
    } else {
      void form.handleSubmit(onSubmit)(event);
    }
  }

  /** The translated error under a box, if that box has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  return (
    <form onSubmit={handleFormSubmit} noValidate>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card>
          <CardContent className="space-y-6">
            {/* ── Which step we are on: numbers on phones, numbers and titles on bigger screens ── */}
            <div className="space-y-3">
              <ol className="grid grid-cols-3 gap-2">
                {STEPS.map((item, index) => (
                  <li
                    key={item.titleKey}
                    aria-current={index === step ? "step" : undefined}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border-2 p-2 text-sm font-medium sm:justify-start",
                      index === step && "border-primary bg-accent",
                      index < step && "border-primary/40 text-primary",
                      index > step && "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                        index <= step ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {index < step ? <Check className="size-3.5" aria-hidden /> : format.number(index + 1)}
                    </span>
                    <span className="hidden truncate sm:inline">{t(item.titleKey)}</span>
                  </li>
                ))}
              </ol>
              <h2 className="text-xl font-bold">
                <span className="block text-sm font-normal text-muted-foreground">
                  {t("stepOf", { step: step + 1, total: STEPS.length })}
                </span>
                {t(STEPS[step].titleKey)}
              </h2>
            </div>

            {/* ── Step 1: the job ── */}
            {step === 0 && (
              <FieldGroup>
                <FieldSet>
                  <FieldLegend variant="label">{tSearch("work")}</FieldLegend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {machine.workTypes.map((work) => (
                      <OptionCard key={work} className="min-h-14" inputProps={{ value: work, ...form.register("workType") }}>
                        <WorkTypeIcon workType={work} className="size-6 shrink-0 text-primary" />
                        {tWork(work)}
                      </OptionCard>
                    ))}
                  </div>
                </FieldSet>

                <div className="grid gap-5 sm:grid-cols-2">
                  <FieldSet>
                    <FieldLegend variant="label">{tSearch("landSize")}</FieldLegend>
                    <div className="space-y-2">
                      <Input
                        aria-label={tSearch("landSize")}
                        inputMode="decimal"
                        aria-invalid={!!errors.landValue}
                        {...form.register("landValue", { setValueAs: numberFromInput })}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {LAND_UNITS.map((unit) => (
                          <OptionCard key={unit} className="justify-center px-2" inputProps={{ value: unit, ...form.register("landUnit") }}>
                            {tUnit(unit)}
                          </OptionCard>
                        ))}
                      </div>
                    </div>
                    {errorText(errors.landValue?.message)}
                  </FieldSet>

                  {/* Machines rented per hour or per day need to know for how long */}
                  {billingUnit !== "PER_ACRE" && (
                    <Field data-invalid={!!errors.hoursOrDays}>
                      <FieldLabel htmlFor="hoursOrDays">{billingUnit === "PER_HOUR" ? tSearch("hours") : tSearch("days")}</FieldLabel>
                      <Input
                        id="hoursOrDays"
                        inputMode="decimal"
                        aria-invalid={!!errors.hoursOrDays}
                        {...form.register("hoursOrDays", { setValueAs: numberFromInput })}
                      />
                      {errorText(errors.hoursOrDays?.message)}
                    </Field>
                  )}
                </div>

                <FieldSet>
                  <FieldLegend variant="label">{tSearch("field")}</FieldLegend>
                  <Field className="sm:max-w-xs">
                    <FieldLabel htmlFor="jumpUpazila">{tSearch("jumpTo")}</FieldLabel>
                    <UpazilaSelect
                      id="jumpUpazila"
                      value={jumpUpazilaId}
                      onChange={jumpToUpazila}
                      upazilas={upazilas}
                      placeholder={tSearch("chooseUpazila")}
                    />
                  </Field>
                  <MapPicker value={field} center={field} onChange={setPoint} />
                  {errorText(errors.lat?.message ?? errors.lng?.message)}
                </FieldSet>

                <Field data-invalid={!!errors.fieldAddress}>
                  <FieldLabel htmlFor="fieldAddress">{t("fieldAddress")}</FieldLabel>
                  <Input id="fieldAddress" placeholder={t("fieldAddressPlaceholder")} {...form.register("fieldAddress")} />
                  {errorText(errors.fieldAddress?.message)}
                </Field>
              </FieldGroup>
            )}

            {/* ── Step 2: the day and the start time ── */}
            {step === 1 && (
              <FieldGroup>
                <Field data-invalid={!!errors.day} className="sm:max-w-xs">
                  <FieldLabel htmlFor="day">{tSearch("day")}</FieldLabel>
                  <Input id="day" type="date" min={today} max={addDays(today, MAX_DAYS_AHEAD)} {...form.register("day")} />
                  {errorText(errors.day?.message)}
                </Field>

                <FieldSet>
                  <FieldLegend variant="label">{t("startTime")}</FieldLegend>
                  {/* Radio buttons give text ("8"), but startHour is a number, so we connect them by hand */}
                  <Controller
                    control={form.control}
                    name="startHour"
                    render={({ field: hourField }) => (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {START_HOURS.map((hour) => (
                          <OptionCard
                            key={hour}
                            className="justify-center px-1 has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted-foreground has-[:disabled]:line-through"
                            inputProps={{
                              name: "startHour",
                              value: String(hour),
                              checked: hourField.value === hour,
                              disabled: isTaken(hour),
                              onChange: () => hourField.onChange(hour),
                            }}
                          >
                            {timeText(getJobStartAt(dayIsValid ? day : today, hour))}
                          </OptionCard>
                        ))}
                      </div>
                    )}
                  />
                  <p className="text-sm text-muted-foreground">{t("takenHint")}</p>
                  {errorText(errors.startHour?.message)}
                  {chosenTimeTaken && <FieldError>{tError("timeTaken")}</FieldError>}
                </FieldSet>

                {jobTime && (
                  <p className="rounded-lg bg-accent p-3 text-sm">
                    {t("duration", {
                      hours: estimateWorkHours(billingUnit, estimate.quantity),
                      start: dayTimeText(jobTime.startAt),
                      end: dayTimeText(jobTime.endAt),
                    })}
                  </p>
                )}

                {dayIsValid && (
                  <div className="space-y-1 text-sm">
                    {busyThatDay.length === 0 ? (
                      <p className="text-green-700">{t("freeAllDay")}</p>
                    ) : (
                      <>
                        <p className="font-medium">{t("busyThatDay")}</p>
                        <ul className="list-inside list-disc text-muted-foreground">
                          {busyThatDay.map((busy) => (
                            <li key={busy.startAt.toISOString()}>{busyText(busy)}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </FieldGroup>
            )}

            {/* ── Step 3: check and book ── */}
            {step === 2 && jobTime && (
              <FieldGroup>
                <div className="space-y-2">
                  <p className="font-semibold">{machine.name}</p>
                  <BookingFacts
                    booking={{
                      workType,
                      landDecimal,
                      billingUnit,
                      quantity: estimate.quantity,
                      actualQuantity: null,
                      startAt: jobTime.startAt,
                      endAt: jobTime.endAt,
                      fieldAddress: fieldAddress.trim() === "" ? null : fieldAddress.trim(),
                      distanceKm: estimate.distanceKm,
                      note: null,
                    }}
                  />
                </div>
                <Field data-invalid={!!errors.note}>
                  <FieldLabel htmlFor="note">{t("note")}</FieldLabel>
                  <Textarea id="note" rows={3} placeholder={t("notePlaceholder")} {...form.register("note")} />
                  {errorText(errors.note?.message)}
                </Field>
              </FieldGroup>
            )}

            {/* ── Back / Next / Book now ── */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {step > 0 ? (
                <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={() => setStep(step - 1)}>
                  <ArrowLeft aria-hidden />
                  {t("previous")}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="lg" disabled={isPending}>
                {step < LAST_STEP ? (
                  <>
                    {t("next")}
                    <ArrowRight aria-hidden />
                  </>
                ) : (
                  <>
                    <CalendarCheck aria-hidden />
                    {t("bookNow")}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── The live price ── */}
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>{t("priceTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobIsComplete ? (
              <PriceBreakdown
                price={estimate.price}
                quantity={estimate.quantity}
                billingUnit={billingUnit}
                rate={machine.rate}
                distanceKm={estimate.distanceKm}
                freeKm={pricedType.freeKm}
                deliveryRatePerKm={pricedType.deliveryRatePerKm}
                subsidyPercent={subsidyPercent}
              />
            ) : (
              <p className="text-muted-foreground">{t("priceHint")}</p>
            )}
            <p className="text-sm text-muted-foreground">{t("payNote")}</p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
