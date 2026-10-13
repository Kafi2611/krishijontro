"use client";
// The public price calculator: pick a machine, how much work, a rate inside the
// government limit and the distance to the field. The price is worked out right here in
// the browser, with the same calculateBookingPrice() the server uses, every time a box
// changes. Nothing is saved, so no server action and no Zod form are needed.
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { OptionCard } from "@/components/option-card";
import { PriceBreakdown } from "@/components/price-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { numberFromInput } from "@/lib/form-values";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { decimalToAcre, toDecimal, type LandUnit } from "@/lib/services/geo";
import { calculateBookingPrice, getBillingQuantity, isRateAllowed } from "@/lib/services/pricing";
import type { PricedMachineType } from "@/lib/services/pricing-rule";

const LAND_UNITS: LandUnit[] = ["DECIMAL", "BIGHA", "ACRE"];

type PriceCalculatorProps = {
  machineTypes: PricedMachineType[];
  subsidyPercent: number | null; // discount of the open subsidy program, or null if there is none
  platformFeePercent: number;
};

/**
 * Reads a number from a text box (Bangla digits allowed).
 * Returns null if the box is empty, is not a number, or is below 0.
 */
function readNumber(text: string): number | null {
  const value = numberFromInput(text);
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/** The starting rate for a machine type: the middle of its allowed range. Example: 2000–3000 -> 2500. */
function middleRate(machineType: PricedMachineType): number {
  return Math.round((machineType.minRate + machineType.maxRate) / 2);
}

/** The starting hours (or days) for a machine type: its minimum charge, but at least 1. */
function startingHours(machineType: PricedMachineType): number {
  return Math.max(1, machineType.minCharge);
}

export function PriceCalculator({ machineTypes, subsidyPercent, platformFeePercent }: PriceCalculatorProps) {
  const t = useTranslations("PriceCalculator");
  const tUnit = useTranslations("LandUnits");
  const tPrice = useTranslations("Price");
  const locale = useLocale();

  // What the person has typed or chosen. Text boxes keep text; we turn it into numbers below.
  const [machineTypeId, setMachineTypeId] = useState(machineTypes[0].id);
  const [landText, setLandText] = useState("66");
  const [landUnit, setLandUnit] = useState<LandUnit>("DECIMAL");
  const [hoursText, setHoursText] = useState(String(startingHours(machineTypes[0])));
  const [rateText, setRateText] = useState(String(middleRate(machineTypes[0])));
  const [distanceText, setDistanceText] = useState("5");
  const [useSubsidy, setUseSubsidy] = useState(false);

  const machineType = machineTypes.find((type) => type.id === machineTypeId) ?? machineTypes[0];
  const isPerAcre = machineType.billingUnit === "PER_ACRE";

  /** A new machine type has another rate limit, so start its rate and hours fresh. */
  function chooseMachineType(id: string) {
    const chosen = machineTypes.find((type) => type.id === id);
    if (!chosen) {
      return;
    }
    setMachineTypeId(id);
    setRateText(String(middleRate(chosen)));
    setHoursText(String(startingHours(chosen)));
  }

  // ── Turn the boxes into numbers, then work out the price (only when everything is valid) ──
  const landValue = readNumber(landText);
  const landDecimal = landValue !== null && landValue > 0 ? toDecimal(landValue, landUnit) : null;
  const hoursOrDays = readNumber(hoursText);
  const rate = readNumber(rateText);
  const distanceKm = readNumber(distanceText);

  const sizeIsValid = isPerAcre ? landDecimal !== null : hoursOrDays !== null && hoursOrDays > 0;
  const rateIsInside = rate !== null && isRateAllowed(rate, machineType);
  const discount = useSubsidy && subsidyPercent !== null ? subsidyPercent : 0;

  const quantity = getBillingQuantity(machineType.billingUnit, landDecimal ?? 0, hoursOrDays ?? 0);
  const price =
    sizeIsValid && rateIsInside && distanceKm !== null
      ? calculateBookingPrice({
          quantity,
          rate,
          minCharge: machineType.minCharge,
          distanceKm,
          freeKm: machineType.freeKm,
          deliveryRatePerKm: machineType.deliveryRatePerKm,
          subsidyPercent: discount,
          platformFeePercent,
        })
      : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardContent>
          <FieldGroup>
            {/* ── 1. Machine ── */}
            <FieldSet>
              <FieldLegend>{t("machine")}</FieldLegend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {machineTypes.map((type) => (
                  <OptionCard
                    key={type.id}
                    className="min-h-14"
                    inputProps={{
                      name: "machineType",
                      value: type.id,
                      checked: type.id === machineTypeId,
                      onChange: () => chooseMachineType(type.id),
                    }}
                  >
                    <MachineTypeIcon icon={type.icon} className="size-6 shrink-0 text-primary" />
                    {pickByLocale(type.name, type.nameBn, locale)}
                  </OptionCard>
                ))}
              </div>
            </FieldSet>

            {/* ── 2. How much work: land for "per acre" machines, otherwise hours or days ── */}
            {isPerAcre ? (
              <FieldSet>
                <FieldLegend>{t("landSize")}</FieldLegend>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    aria-label={t("landSize")}
                    inputMode="decimal"
                    value={landText}
                    onChange={(event) => setLandText(event.target.value)}
                    aria-invalid={landDecimal === null}
                  />
                  <div className="grid grid-cols-3 gap-1">
                    {LAND_UNITS.map((unit) => (
                      <OptionCard
                        key={unit}
                        className="justify-center px-2"
                        inputProps={{
                          name: "landUnit",
                          value: unit,
                          checked: unit === landUnit,
                          onChange: () => setLandUnit(unit),
                        }}
                      >
                        {tUnit(unit)}
                      </OptionCard>
                    ))}
                  </div>
                </div>
                {landDecimal !== null ? (
                  <FieldDescription>
                    {t("landInDecimal", { decimal: landDecimal, acre: decimalToAcre(landDecimal) })}
                  </FieldDescription>
                ) : (
                  <FieldError>{t("numberNeeded")}</FieldError>
                )}
              </FieldSet>
            ) : (
              <Field data-invalid={!sizeIsValid}>
                <FieldLabel htmlFor="hours">{machineType.billingUnit === "PER_HOUR" ? t("hours") : t("days")}</FieldLabel>
                <Input id="hours" inputMode="decimal" value={hoursText} onChange={(event) => setHoursText(event.target.value)} />
                {!sizeIsValid && <FieldError>{t("numberNeeded")}</FieldError>}
              </Field>
            )}

            {/* ── 3. Rate: a slider and a box, both inside the government limit ── */}
            <Field data-invalid={!rateIsInside}>
              <FieldLabel htmlFor="rate">{t("rate", { unit: machineType.billingUnit })}</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  aria-label={t("rate", { unit: machineType.billingUnit })}
                  min={machineType.minRate}
                  max={machineType.maxRate}
                  value={rateIsInside ? rate : machineType.minRate}
                  onChange={(event) => setRateText(event.target.value)}
                  className="h-11 min-w-0 flex-1 accent-primary"
                />
                <Input id="rate" inputMode="numeric" className="w-28" value={rateText} onChange={(event) => setRateText(event.target.value)} />
              </div>
              <FieldDescription>{t("rateHint", { min: machineType.minRate, max: machineType.maxRate })}</FieldDescription>
              {!rateIsInside && <FieldError>{t("rateOutside")}</FieldError>}
            </Field>

            {/* ── 4. Distance ── */}
            <Field data-invalid={distanceKm === null}>
              <FieldLabel htmlFor="distance">{t("distance")}</FieldLabel>
              <Input id="distance" inputMode="decimal" value={distanceText} onChange={(event) => setDistanceText(event.target.value)} />
              <FieldDescription>
                {t("distanceHint", { freeKm: machineType.freeKm, rate: machineType.deliveryRatePerKm })}
              </FieldDescription>
              {distanceKm === null && <FieldError>{t("numberNeeded")}</FieldError>}
            </Field>

            {/* ── 5. Subsidy (only when the government has an open program) ── */}
            {subsidyPercent !== null && (
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                  checked={useSubsidy}
                  onChange={(event) => setUseSubsidy(event.target.checked)}
                />
                <span>
                  <span className="font-medium">{t("subsidy", { percent: subsidyPercent })}</span>
                  <span className="block text-sm text-muted-foreground">{t("subsidyHint")}</span>
                </span>
              </label>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {/* The result: stays in view on big screens while the person changes the boxes */}
      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>{t("resultTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {price && rate !== null && distanceKm !== null ? (
            <PriceBreakdown
              price={price}
              quantity={quantity}
              billingUnit={machineType.billingUnit}
              rate={rate}
              distanceKm={distanceKm}
              freeKm={machineType.freeKm}
              deliveryRatePerKm={machineType.deliveryRatePerKm}
              subsidyPercent={discount}
            />
          ) : (
            <p className="text-muted-foreground">{t("fillAll")}</p>
          )}
          <p className="text-sm text-muted-foreground">{tPrice("estimateNote")}</p>
          <Button asChild size="lg" className="w-full">
            <Link href="/farmer/search">
              <Search aria-hidden />
              {t("findMachine")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
