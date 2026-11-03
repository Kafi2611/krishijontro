"use client";
// The cooperative leader's group booking form, in 3 steps:
//   1. The job    — the work, the machine type, the day and start time, the village on the map
//   2. The plots  — tick the members (at least 2); for each: their land (or hours / days) and a
//                   short note so the operator finds the plot
//   3. A machine  — the server lists the machines free for the WHOLE time (plot after plot), with
//                   every member's price; the leader picks one and presses "Book for N members".
// "Next" only checks the boxes of the current step; booking sends everything to the server,
// which checks it all again (lib/services/group-booking.ts).
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CalendarCheck, Check, SearchX } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { MapPicker } from "@/components/map/map-picker";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { WorkTypeIcon } from "@/components/work-type-icon";
import { WorkType } from "@/generated/prisma/enums";
import { createGroupBookingAction, findGroupMachinesAction } from "@/lib/actions/group-booking";
import { numberFromInput } from "@/lib/form-values";
import { pickByLocale } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";
import { getJobStartAt, START_HOURS } from "@/lib/services/booking-rules";
import { addDays } from "@/lib/services/calendar";
import type { LatLng } from "@/lib/services/geo";
import type { GroupMachineChoice, GroupMember } from "@/lib/services/group-booking";
import type { PricedMachineType } from "@/lib/services/pricing-rule";
import { cn } from "@/lib/utils";
import { groupBookingSchema, MAX_GROUP_PLOTS, type GroupBookingInput } from "@/lib/validators/group-booking";
import { MAX_DAYS_AHEAD, SEARCH_DISTANCES_KM } from "@/lib/validators/search";
import type { ValidationKey } from "@/lib/validators/types";

type GroupBookingFormProps = {
  members: GroupMember[];
  machineTypes: PricedMachineType[]; // the types with a price rule today
  defaultValues: GroupBookingInput;
  today: string; // "YYYY-MM-DD"
  locale: string;
};

/** The title of each step, and the boxes "Next" checks before going on. */
const STEPS: { titleKey: "stepJob" | "stepPlots" | "stepMachine"; fields: (keyof GroupBookingInput)[] }[] = [
  { titleKey: "stepJob", fields: ["workType", "machineTypeId", "day", "startHour", "lat", "lng", "maxKm"] },
  { titleKey: "stepPlots", fields: ["plots"] },
  { titleKey: "stepMachine", fields: ["machineId"] },
];
const LAST_STEP = STEPS.length - 1;

export function GroupBookingForm({ members, machineTypes, defaultValues, today, locale }: GroupBookingFormProps) {
  const t = useTranslations("GroupBooking");
  const tSearch = useTranslations("Search");
  const tWork = useTranslations("WorkTypes");
  const tPrice = useTranslations("Price");
  const tError = useTranslations("Validation");
  const format = useFormatter();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  // The machines the server found for this group (step 3), or null before searching.
  const [found, setFound] = useState<{ choices: GroupMachineChoice[]; busyCount: number } | null>(null);

  const form = useForm<GroupBookingInput>({ resolver: zodResolver(groupBookingSchema), defaultValues });
  const errors = form.formState.errors;
  // useFieldArray keeps the list of plots (one row per ticked member).
  const plots = useFieldArray({ control: form.control, name: "plots", keyName: "rowKey" });
  const [workType, machineTypeId, lat, lng, machineId] = useWatch({
    control: form.control,
    name: ["workType", "machineTypeId", "lat", "lng", "machineId"],
  });

  // Only the work that some priced machine type can do, in the usual order.
  const workChoices = Object.values(WorkType).filter((work) => machineTypes.some((type) => type.workTypes.includes(work)));
  const typesForWork = machineTypes.filter((type) => type.workTypes.includes(workType));
  const chosenType = machineTypes.find((type) => type.id === machineTypeId) ?? null;
  const unit = chosenType?.billingUnit ?? "PER_ACRE";
  const chosenMachine = found?.choices.find((choice) => choice.id === machineId) ?? null;
  const pin: LatLng = { lat, lng };

  /** A new work or machine type changes the unit and the machines: start the plots and the search again. */
  function resetPlots() {
    plots.replace([]);
    form.setValue("machineId", "");
    setFound(null);
  }

  /** Saves the map point into the form (both lat and lng). */
  function setPin(point: LatLng) {
    form.setValue("lat", point.lat, { shouldValidate: true });
    form.setValue("lng", point.lng, { shouldValidate: true });
  }

  /** Ticks or unticks a member: adds their plot row (with a first amount) or removes it. */
  function toggleMember(member: GroupMember) {
    const index = plots.fields.findIndex((row) => row.farmerId === member.farmerId);
    if (index >= 0) {
      plots.remove(index);
      return;
    }
    // A first amount the leader can change: the member's land (per acre), or 2 hours / 1 day.
    let amount = 1;
    if (unit === "PER_ACRE") {
      amount = member.landDecimal > 0 ? member.landDecimal : 33; // 33 decimal = 1 bigha
    } else if (unit === "PER_HOUR") {
      amount = 2;
    }
    plots.append({ farmerId: member.farmerId, amount, plotNote: "" });
  }

  /** Asks the server for the machines free for the whole group (step 3). */
  function searchMachines() {
    form.setValue("machineId", "");
    startTransition(async () => {
      const result = await findGroupMachinesAction(form.getValues());
      if (!result.ok) {
        toast.error(tError(result.error));
        setFound(null);
        return;
      }
      setFound({ choices: result.choices, busyCount: result.busyCount });
    });
  }

  /** "Next": checks this step's boxes, then shows the next step (step 3 starts the search). */
  async function goToNextStep() {
    const stepIsValid = await form.trigger(STEPS[step].fields);
    if (!stepIsValid) {
      return;
    }
    if (step + 1 === LAST_STEP) {
      searchMachines();
    }
    setStep(step + 1);
  }

  /** Runs when "Book" is pressed and the whole form passed the Zod check. */
  function onSubmit(values: GroupBookingInput) {
    if (values.machineId === "") {
      form.setError("machineId", { message: "chooseMachine" });
      return;
    }
    startTransition(async () => {
      const result = await createGroupBookingAction(values);
      if (result.ok) {
        toast.success(t("booked"));
        router.push(`/cooperative/group-bookings/${result.groupBookingId}`);
        return;
      }
      toast.error(tError(result.error));
      // Someone else booked this machine a moment ago: search again for what is free now.
      if (result.error === "timeTaken" || result.error === "machineBlocked" || result.error === "machineNotAvailable") {
        searchMachines();
      }
    });
  }

  /** The Enter key or the main button: the next step, or "Book" on the last step. */
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

  const timeText = (date: Date) => format.dateTime(date, { hour: "numeric", minute: "2-digit" });

  return (
    <form onSubmit={handleFormSubmit} noValidate>
      <Card>
        <CardContent className="space-y-6">
          {/* ── Which step we are on ── */}
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
                  {workChoices.map((work) => (
                    <OptionCard
                      key={work}
                      className="min-h-14"
                      inputProps={{
                        value: work,
                        ...form.register("workType", {
                          onChange: () => {
                            form.setValue("machineTypeId", "");
                            resetPlots();
                          },
                        }),
                      }}
                    >
                      <WorkTypeIcon workType={work} className="size-6 shrink-0 text-primary" />
                      {tWork(work)}
                    </OptionCard>
                  ))}
                </div>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">{tSearch("machine")}</FieldLegend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {typesForWork.map((type) => (
                    <OptionCard
                      key={type.id}
                      className="min-h-14"
                      inputProps={{ value: type.id, ...form.register("machineTypeId", { onChange: resetPlots }) }}
                    >
                      <MachineTypeIcon icon={type.icon} className="size-6 shrink-0 text-primary" />
                      {pickByLocale(type.name, type.nameBn, locale)}
                    </OptionCard>
                  ))}
                </div>
                {errorText(errors.machineTypeId?.message)}
              </FieldSet>

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
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {START_HOURS.map((hour) => (
                        <OptionCard
                          key={hour}
                          className="justify-center px-1"
                          inputProps={{
                            name: "startHour",
                            value: String(hour),
                            checked: hourField.value === hour,
                            onChange: () => hourField.onChange(hour),
                          }}
                        >
                          {timeText(getJobStartAt(today, hour))}
                        </OptionCard>
                      ))}
                    </div>
                  )}
                />
                <p className="text-sm text-muted-foreground">{t("startTimeHint")}</p>
                {errorText(errors.startHour?.message)}
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">{t("village")}</FieldLegend>
                <p className="text-sm text-muted-foreground">{t("villageHint")}</p>
                <MapPicker value={pin} center={pin} onChange={setPin} />
                {errorText(errors.lat?.message ?? errors.lng?.message)}
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">{tSearch("distance")}</FieldLegend>
                <Controller
                  control={form.control}
                  name="maxKm"
                  render={({ field: kmField }) => (
                    <div className="grid grid-cols-5 gap-2">
                      {SEARCH_DISTANCES_KM.map((km) => (
                        <OptionCard
                          key={km}
                          className="justify-center px-1"
                          inputProps={{ name: "maxKm", value: String(km), checked: kmField.value === km, onChange: () => kmField.onChange(km) }}
                        >
                          {tSearch("km", { km })}
                        </OptionCard>
                      ))}
                    </div>
                  )}
                />
              </FieldSet>
            </FieldGroup>
          )}

          {/* ── Step 2: the members' plots ── */}
          {step === 1 && (
            <FieldGroup>
              <p className="text-sm text-muted-foreground">{t("plotsHint", { max: MAX_GROUP_PLOTS })}</p>
              {members.length < 2 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{t("needMembers")}</p>}
              <ul className="space-y-3">
                {members.map((member) => {
                  const index = plots.fields.findIndex((row) => row.farmerId === member.farmerId);
                  const isChosen = index >= 0;
                  const plotErrors = isChosen ? errors.plots?.[index] : undefined;
                  return (
                    <li key={member.farmerId} className={cn("space-y-3 rounded-lg border-2 p-3", isChosen && "border-primary bg-accent/40")}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium">
                        <input
                          type="checkbox"
                          className="size-5 accent-primary"
                          checked={isChosen}
                          onChange={() => toggleMember(member)}
                        />
                        {member.name}
                      </label>
                      {isChosen && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field data-invalid={!!plotErrors?.amount}>
                            <FieldLabel htmlFor={`amount-${member.farmerId}`}>{t("amountLabel", { unit })}</FieldLabel>
                            <Input
                              id={`amount-${member.farmerId}`}
                              inputMode="decimal"
                              aria-invalid={!!plotErrors?.amount}
                              {...form.register(`plots.${index}.amount`, { setValueAs: numberFromInput })}
                            />
                            {errorText(plotErrors?.amount?.message)}
                          </Field>
                          <Field data-invalid={!!plotErrors?.plotNote}>
                            <FieldLabel htmlFor={`note-${member.farmerId}`}>{t("plotNote")}</FieldLabel>
                            <Input
                              id={`note-${member.farmerId}`}
                              placeholder={t("plotNotePlaceholder")}
                              {...form.register(`plots.${index}.plotNote`)}
                            />
                            {errorText(plotErrors?.plotNote?.message)}
                          </Field>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {/* The rule "at least 2 plots" belongs to the whole list, not to one row */}
              {errorText(errors.plots?.root?.message ?? errors.plots?.message)}
            </FieldGroup>
          )}

          {/* ── Step 3: the machine ── */}
          {step === 2 && (
            <div className="space-y-4">
              {isPending && !found && <p className="text-muted-foreground">{t("searching")}</p>}
              {found && found.choices.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-lg border p-6 text-center">
                  <SearchX className="size-10 text-muted-foreground" aria-hidden />
                  <p className="font-semibold">{t("noMachines")}</p>
                  <p className="text-sm text-muted-foreground">{t("noMachinesHint", { busy: found.busyCount })}</p>
                </div>
              )}
              {found && found.choices.length > 0 && (
                <FieldSet>
                  <FieldLegend variant="label">{t("chooseMachine")}</FieldLegend>
                  <div className="grid gap-2">
                    {found.choices.map((choice) => (
                      <OptionCard key={choice.id} className="block py-3" inputProps={{ value: choice.id, ...form.register("machineId") }}>
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{choice.name}</span>
                          <span className="font-bold text-primary tabular-nums">{tPrice("amount", { amount: choice.groupTotal })}</span>
                        </span>
                        <span className="block font-normal text-muted-foreground">
                          {t("machineFacts", {
                            provider: choice.providerName,
                            km: choice.distanceKm,
                            delivery: choice.totalDeliveryCharge,
                            count: choice.plots.length,
                          })}
                        </span>
                      </OptionCard>
                    ))}
                  </div>
                  {errorText(errors.machineId?.message)}
                </FieldSet>
              )}

              {chosenMachine && (
                <div className="space-y-2 rounded-lg bg-muted p-3">
                  <p className="font-semibold">{t("summaryTitle")}</p>
                  <ol className="space-y-2 text-sm">
                    {chosenMachine.plots.map((plot) => (
                      <li key={plot.farmerId} className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 last:border-b-0">
                        <span>
                          <span className="font-medium">{plot.farmerName}</span>
                          <span className="block text-muted-foreground">
                            {timeText(plot.startAt)}–{timeText(plot.endAt)} ·{" "}
                            {t("deliveryShare", { amount: plot.bill.deliveryCharge })}
                            {plot.bill.minimumShare > 0 && ` · ${t("minimumShare", { amount: plot.bill.minimumShare })}`}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums">{tPrice("amount", { amount: plot.bill.totalAmount })}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-sm text-muted-foreground">{t("payNote")}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Back / Next / Book ── */}
          <div className="flex flex-wrap justify-between gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={() => setStep(step - 1)}>
                <ArrowLeft aria-hidden />
                {t("previous")}
              </Button>
            ) : (
              <span />
            )}
            {step < LAST_STEP ? (
              <Button type="submit" size="lg" disabled={isPending}>
                {t("next")}
                <ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={isPending || !chosenMachine}>
                <CalendarCheck aria-hidden />
                {t("bookButton", { count: chosenMachine?.plots.length ?? 0 })}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
