"use client";
// The provider's form to add a new machine or edit one:
// type, brand, model, year, HP, registration no., rate, place (upazila + map),
// photos and engine hours. Zod (machineSchema) checks it here and again on the server.
// The rate must stay inside the government limit, which is shown under the rate box.
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ImageUploader } from "@/components/image-uploader";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { MapPicker } from "@/components/map/map-picker";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UpazilaSelect } from "@/components/upazila-select";
import type { BillingUnit } from "@/generated/prisma/enums";
import { createMachineAction, updateMachineAction } from "@/lib/actions/machine";
import { numberFromInput } from "@/lib/form-values";
import { pickByLocale } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";
import { BANGLADESH_CENTER, type LatLng } from "@/lib/services/geo";
import type { UpazilaOption } from "@/lib/services/location";
import { isRateAllowed, type RateRange } from "@/lib/services/pricing";
import { machineSchema, type MachineInput } from "@/lib/validators/machine";
import type { ValidationKey } from "@/lib/validators/types";
import { MAX_MACHINE_PHOTOS } from "@/lib/validators/upload";

export type MachineTypeChoice = {
  id: string;
  name: string;
  nameBn: string;
  icon: string;
  billingUnit: BillingUnit;
};

type MachineFormProps = {
  machineId?: string; // given when editing; empty when adding
  defaultValues: Partial<MachineInput>;
  machineTypes: MachineTypeChoice[];
  rateRanges: Record<string, RateRange>; // today's government limit for each machine type id
  upazilas: UpazilaOption[];
};

export function MachineForm({
  machineId,
  defaultValues,
  machineTypes,
  rateRanges,
  upazilas,
}: MachineFormProps) {
  const t = useTranslations("MachineForm");
  const tError = useTranslations("Validation");
  const locale = useLocale();
  const router = useRouter();
  const [serverError, setServerError] = useState<ValidationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<MachineInput>({
    resolver: zodResolver(machineSchema),
    defaultValues,
  });
  const errors = form.formState.errors;

  // Watch some values, so the page can react while the provider types.
  const selectedTypeId = useWatch({ control: form.control, name: "machineTypeId" });
  const selectedLocationId = useWatch({ control: form.control, name: "locationId" });
  const lat = useWatch({ control: form.control, name: "lat" });
  const lng = useWatch({ control: form.control, name: "lng" });

  const selectedType = machineTypes.find((type) => type.id === selectedTypeId);
  const rateRange = selectedTypeId ? rateRanges[selectedTypeId] : undefined;
  const selectedUpazila = upazilas.find((upazila) => upazila.id === selectedLocationId);
  const chosenPoint: LatLng | null = lat !== undefined && lng !== undefined ? { lat, lng } : null;
  const mapCenter =
    selectedUpazila?.lat != null && selectedUpazila.lng != null
      ? { lat: selectedUpazila.lat, lng: selectedUpazila.lng }
      : BANGLADESH_CENTER;

  /** Saves the map point into the form (both lat and lng) and re-checks it. */
  function setPoint(point: LatLng) {
    form.setValue("lat", point.lat, { shouldValidate: true });
    form.setValue("lng", point.lng, { shouldValidate: true });
  }

  /** When an upazila is chosen, move the pin to its centre; the provider can then fine-tune it. */
  function handleUpazilaChange(upazilaId: string) {
    form.setValue("locationId", upazilaId, { shouldValidate: true });
    const upazila = upazilas.find((item) => item.id === upazilaId);
    if (upazila?.lat != null && upazila.lng != null) {
      setPoint({ lat: upazila.lat, lng: upazila.lng });
    }
  }

  /** Runs when the Zod check passed. Checks the government limit, then saves on the server. */
  function onSubmit(values: MachineInput) {
    const range = rateRanges[values.machineTypeId];
    if (!range) {
      form.setError("machineTypeId", { message: "noPriceRule" });
      return;
    }
    if (!isRateAllowed(values.rate, range)) {
      form.setError("rate", { message: "rateOutOfRange" });
      return;
    }

    setServerError(null);
    startTransition(async () => {
      const result = machineId
        ? await updateMachineAction(machineId, values)
        : await createMachineAction(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success(machineId ? t("savedChanges") : t("added"));
      router.push(`/provider/machines/${result.machineId}`);
    });
  }

  /** The translated error under a field, if that field has one. */
  function errorText(message: string | undefined) {
    return message ? <FieldError>{tError(message as ValidationKey)}</FieldError> : null;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {/* ── 1. Which machine ── */}
        <FieldSet>
          <FieldLegend>{t("sectionMachine")}</FieldLegend>
          <FieldSet>
            <FieldLegend variant="label">{t("machineType")}</FieldLegend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {machineTypes.map((type) => (
                <OptionCard
                  key={type.id}
                  className="min-h-14"
                  inputProps={{ value: type.id, ...form.register("machineTypeId") }}
                >
                  <MachineTypeIcon icon={type.icon} className="size-6 shrink-0 text-primary" />
                  {pickByLocale(type.name, type.nameBn, locale)}
                </OptionCard>
              ))}
            </div>
            {errorText(errors.machineTypeId?.message)}
          </FieldSet>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.brand}>
              <FieldLabel htmlFor="brand">{t("brand")}</FieldLabel>
              <Input id="brand" placeholder={t("brandPlaceholder")} aria-invalid={!!errors.brand} {...form.register("brand")} />
              {errorText(errors.brand?.message)}
            </Field>
            <Field data-invalid={!!errors.model}>
              <FieldLabel htmlFor="model">{t("model")}</FieldLabel>
              <Input id="model" placeholder={t("modelPlaceholder")} aria-invalid={!!errors.model} {...form.register("model")} />
              {errorText(errors.model?.message)}
            </Field>
            <Field data-invalid={!!errors.year}>
              <FieldLabel htmlFor="year">{t("year")}</FieldLabel>
              <Input
                id="year"
                inputMode="numeric"
                placeholder="2021"
                aria-invalid={!!errors.year}
                {...form.register("year", { setValueAs: numberFromInput })}
              />
              {errorText(errors.year?.message)}
            </Field>
            <Field data-invalid={!!errors.horsePower}>
              <FieldLabel htmlFor="horsePower">
                {t("horsePower")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
              </FieldLabel>
              <Input
                id="horsePower"
                inputMode="numeric"
                aria-invalid={!!errors.horsePower}
                {...form.register("horsePower", { setValueAs: numberFromInput })}
              />
              {errorText(errors.horsePower?.message)}
            </Field>
          </div>

          <Field data-invalid={!!errors.registrationNo}>
            <FieldLabel htmlFor="registrationNo">
              {t("registrationNo")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </FieldLabel>
            <Input id="registrationNo" placeholder="RAJ-TR-1001" aria-invalid={!!errors.registrationNo} {...form.register("registrationNo")} />
            <FieldDescription>{t("registrationHint")}</FieldDescription>
            {errorText(errors.registrationNo?.message)}
          </Field>
        </FieldSet>

        {/* ── 2. Rent ── */}
        <FieldSet>
          <FieldLegend>{t("sectionRent")}</FieldLegend>
          <Field data-invalid={!!errors.rate}>
            <FieldLabel htmlFor="rate">
              {t("rate", { unit: selectedType?.billingUnit ?? "PER_ACRE" })}
            </FieldLabel>
            <Input
              id="rate"
              inputMode="numeric"
              aria-invalid={!!errors.rate}
              {...form.register("rate", { setValueAs: numberFromInput })}
            />
            {rateRange && (
              <FieldDescription>
                {t("rateAllowed", { min: rateRange.minRate, max: rateRange.maxRate })}
                {rateRange.inHarvestSeason && ` ${t("seasonNote")}`}
              </FieldDescription>
            )}
            {selectedType && !rateRange && <FieldError>{tError("noPriceRule")}</FieldError>}
            {errorText(errors.rate?.message)}
          </Field>
        </FieldSet>

        {/* ── 3. Where the machine is kept ── */}
        <FieldSet>
          <FieldLegend>{t("sectionPlace")}</FieldLegend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.locationId}>
              <FieldLabel htmlFor="locationId">{t("upazila")}</FieldLabel>
              {/* UpazilaSelect is not a plain <input>, so we connect it with a Controller */}
              <Controller
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <UpazilaSelect
                    id="locationId"
                    value={field.value ?? ""}
                    onChange={handleUpazilaChange}
                    upazilas={upazilas}
                    placeholder={t("chooseUpazila")}
                    invalid={!!errors.locationId}
                  />
                )}
              />
              {errorText(errors.locationId?.message)}
            </Field>
            <Field data-invalid={!!errors.address}>
              <FieldLabel htmlFor="address">
                {t("address")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
              </FieldLabel>
              <Input id="address" placeholder={t("addressPlaceholder")} aria-invalid={!!errors.address} {...form.register("address")} />
              {errorText(errors.address?.message)}
            </Field>
          </div>
          <Field data-invalid={!!errors.lat}>
            <FieldLabel>{t("mapLabel")}</FieldLabel>
            <MapPicker value={chosenPoint} center={mapCenter} onChange={setPoint} />
            {errorText(errors.lat?.message ?? errors.lng?.message)}
          </Field>
        </FieldSet>

        {/* ── 4. Photos ── */}
        <FieldSet>
          <FieldLegend>{t("sectionPhotos")}</FieldLegend>
          <Controller
            control={form.control}
            name="imageUrls"
            render={({ field }) => (
              <ImageUploader value={field.value ?? []} onChange={field.onChange} maxImages={MAX_MACHINE_PHOTOS} />
            )}
          />
          {errorText(errors.imageUrls?.message)}
        </FieldSet>

        {/* ── 5. Engine and service ── */}
        <FieldSet>
          <FieldLegend>{t("sectionEngine")}</FieldLegend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.engineHours}>
              <FieldLabel htmlFor="engineHours">{t("engineHours")}</FieldLabel>
              <Input
                id="engineHours"
                inputMode="decimal"
                aria-invalid={!!errors.engineHours}
                {...form.register("engineHours", { setValueAs: numberFromInput })}
              />
              {errorText(errors.engineHours?.message)}
            </Field>
            <Field data-invalid={!!errors.serviceDueHours}>
              <FieldLabel htmlFor="serviceDueHours">{t("serviceDueHours")}</FieldLabel>
              <Input
                id="serviceDueHours"
                inputMode="decimal"
                aria-invalid={!!errors.serviceDueHours}
                {...form.register("serviceDueHours", { setValueAs: numberFromInput })}
              />
              {errorText(errors.serviceDueHours?.message)}
            </Field>
          </div>
          <FieldDescription>{t("serviceHint")}</FieldDescription>
        </FieldSet>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">
            {t("description")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </FieldLabel>
          <Textarea
            id="description"
            rows={3}
            placeholder={t("descriptionPlaceholder")}
            aria-invalid={!!errors.description}
            {...form.register("description")}
          />
          {errorText(errors.description?.message)}
        </Field>

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {tError(serverError)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          <Save aria-hidden />
          {machineId ? t("submitSave") : t("submitAdd")}
        </Button>
      </FieldGroup>
    </form>
  );
}
