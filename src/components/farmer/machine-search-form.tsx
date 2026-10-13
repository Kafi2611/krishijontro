"use client";
// The farmer's search form: the work, which machine (or any), land size, hours/days
// (only for machines rented by the hour or day), the day, the field on the map and how
// far to look. Zod (machineSearchSchema) checks it here; pressing Search does not call
// the server directly — it puts the search into the page address (?workType=...&...)
// and the search page reads it from there and runs the search on the server.
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { MapPicker } from "@/components/map/map-picker";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UpazilaSelect } from "@/components/upazila-select";
import { WorkTypeIcon } from "@/components/work-type-icon";
import { WorkType } from "@/generated/prisma/enums";
import { numberFromInput } from "@/lib/form-values";
import { pickByLocale } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";
import { addDays } from "@/lib/services/calendar";
import { LAND_UNITS, type LatLng } from "@/lib/services/geo";
import type { UpazilaOption } from "@/lib/services/location";
import type { PricedMachineType } from "@/lib/services/pricing-rule";
import {
  MAX_DAYS_AHEAD,
  machineSearchSchema,
  SEARCH_DISTANCES_KM,
  searchInputToQuery,
  type MachineSearchInput,
} from "@/lib/validators/search";
import type { ValidationKey } from "@/lib/validators/types";

type MachineSearchFormProps = {
  defaultValues: MachineSearchInput;
  machineTypes: PricedMachineType[]; // every type farmers can book today
  upazilas: UpazilaOption[]; // for "go to upazila" above the map
  today: string; // "YYYY-MM-DD": the day box does not allow earlier days
};

export function MachineSearchForm({ defaultValues, machineTypes, upazilas, today }: MachineSearchFormProps) {
  const t = useTranslations("Search");
  const tWork = useTranslations("WorkTypes");
  const tUnit = useTranslations("LandUnits");
  const tError = useTranslations("Validation");
  const locale = useLocale();
  const router = useRouter();
  const [jumpUpazilaId, setJumpUpazilaId] = useState("");

  const form = useForm<MachineSearchInput>({
    resolver: zodResolver(machineSearchSchema),
    defaultValues,
  });
  const errors = form.formState.errors;

  // Watch some values, so the form can change while the farmer chooses.
  const workType = useWatch({ control: form.control, name: "workType" });
  const lat = useWatch({ control: form.control, name: "lat" });
  const lng = useWatch({ control: form.control, name: "lng" });

  // Only the work types that at least one machine type can do.
  const workTypes = Object.values(WorkType).filter((work) =>
    machineTypes.some((type) => type.workTypes.includes(work)),
  );
  const typesForWork = machineTypes.filter((type) => type.workTypes.includes(workType));
  // If a machine for this work is rented per hour or per day, we must ask for how long.
  const timeUnit = typesForWork.find((type) => type.billingUnit !== "PER_ACRE")?.billingUnit;
  const field: LatLng = { lat, lng };

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

  /** Runs when the Zod check passed: opens the search page with the search in its address. */
  function onSubmit(values: MachineSearchInput) {
    router.push(`/farmer/search?${searchInputToQuery(values)}`);
  }

  /** The translated error under a field, if that field has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {/* ── 1. The work ── */}
        <FieldSet>
          <FieldLegend>{t("work")}</FieldLegend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {workTypes.map((work) => (
              <OptionCard
                key={work}
                className="min-h-14"
                inputProps={{
                  value: work,
                  // A new kind of work needs other machines, so forget the machine chosen before.
                  ...form.register("workType", { onChange: () => form.setValue("machineTypeId", "") }),
                }}
              >
                <WorkTypeIcon workType={work} className="size-6 shrink-0 text-primary" />
                {tWork(work)}
              </OptionCard>
            ))}
          </div>
        </FieldSet>

        {/* ── 2. Which machine (only when more than one kind can do this work) ── */}
        {typesForWork.length > 1 && (
          <FieldSet>
            <FieldLegend variant="label">{t("machine")}</FieldLegend>
            <div className="flex flex-wrap gap-2">
              <OptionCard inputProps={{ value: "", ...form.register("machineTypeId") }}>{t("anyMachine")}</OptionCard>
              {typesForWork.map((type) => (
                <OptionCard key={type.id} inputProps={{ value: type.id, ...form.register("machineTypeId") }}>
                  <MachineTypeIcon icon={type.icon} className="size-5 text-primary" />
                  {pickByLocale(type.name, type.nameBn, locale)}
                </OptionCard>
              ))}
            </div>
          </FieldSet>
        )}

        {/* ── 3. How much work ── */}
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldSet>
            <FieldLegend variant="label">{t("landSize")}</FieldLegend>
            <div className="space-y-2">
              <Input
                aria-label={t("landSize")}
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

          {timeUnit && (
            <Field data-invalid={!!errors.hoursOrDays}>
              <FieldLabel htmlFor="hoursOrDays">{timeUnit === "PER_HOUR" ? t("hours") : t("days")}</FieldLabel>
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

        {/* ── 4. The day ── */}
        <Field data-invalid={!!errors.day} className="sm:max-w-xs">
          <FieldLabel htmlFor="day">{t("day")}</FieldLabel>
          <Input id="day" type="date" min={today} max={addDays(today, MAX_DAYS_AHEAD)} {...form.register("day")} />
          {errorText(errors.day?.message)}
        </Field>

        {/* ── 5. Where the field is ── */}
        <FieldSet>
          <FieldLegend>{t("field")}</FieldLegend>
          <Field className="sm:max-w-xs">
            <FieldLabel htmlFor="jumpUpazila">{t("jumpTo")}</FieldLabel>
            <UpazilaSelect
              id="jumpUpazila"
              value={jumpUpazilaId}
              onChange={jumpToUpazila}
              upazilas={upazilas}
              placeholder={t("chooseUpazila")}
            />
          </Field>
          <MapPicker value={field} center={field} onChange={setPoint} />
          {errorText(errors.lat?.message ?? errors.lng?.message)}
        </FieldSet>

        {/* ── 6. How far to look ── */}
        <FieldSet>
          <FieldLegend variant="label">{t("distance")}</FieldLegend>
          {/* Radio buttons give text ("15"), but maxKm is a number, so we connect them by hand */}
          <Controller
            control={form.control}
            name="maxKm"
            render={({ field: maxKmField }) => (
              <div className="grid grid-cols-5 gap-1.5">
                {SEARCH_DISTANCES_KM.map((km) => (
                  <OptionCard
                    key={km}
                    className="justify-center px-1"
                    inputProps={{
                      name: "maxKm",
                      value: String(km),
                      checked: maxKmField.value === km,
                      onChange: () => maxKmField.onChange(km),
                    }}
                  >
                    {t("km", { km })}
                  </OptionCard>
                ))}
              </div>
            )}
          />
        </FieldSet>

        <Button type="submit" size="lg" className="w-full sm:w-auto">
          <Search aria-hidden />
          {t("searchButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}
