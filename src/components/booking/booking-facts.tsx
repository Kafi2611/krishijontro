// The facts of a booking's job as a list: the work, the land, the time booked (for machines
// rented per hour or day), the real work done (after the finish), when, where and how far.
// Used on the booking pages of the farmer, the provider and the operator.
import { useFormatter, useTranslations } from "next-intl";
import { DetailRow } from "@/components/detail-row";
import type { BillingUnit, WorkType } from "@/generated/prisma/enums";
import { toDhakaDay } from "@/lib/services/calendar";

/** The Booking columns this list needs. */
type FactsBooking = {
  workType: WorkType;
  landDecimal: number;
  billingUnit: BillingUnit;
  quantity: number;
  actualQuantity: number | null; // set by the operator at the finish
  startAt: Date;
  endAt: Date;
  fieldAddress: string | null;
  distanceKm: number;
  note: string | null;
};

export function BookingFacts({ booking }: { booking: FactsBooking }) {
  const t = useTranslations("BookingView");
  const tWork = useTranslations("WorkTypes");
  const format = useFormatter();

  // The end is shown with its date only when the job ends on another day (e.g. a 2-day rent).
  const endsSameDay = toDhakaDay(booking.startAt) === toDhakaDay(booking.endAt);
  const start = format.dateTime(booking.startAt, { dateStyle: "medium", timeStyle: "short" });
  const end = endsSameDay
    ? format.dateTime(booking.endAt, { timeStyle: "short" })
    : format.dateTime(booking.endAt, { dateStyle: "medium", timeStyle: "short" });

  return (
    <dl>
      <DetailRow label={t("work")}>{tWork(booking.workType)}</DetailRow>
      <DetailRow label={t("land")}>{t("landValue", { land: booking.landDecimal })}</DetailRow>
      {/* For land machines the land size above is the amount; others are booked for hours or days */}
      {booking.billingUnit !== "PER_ACRE" && (
        <DetailRow label={t("booked")}>{t("quantity", { quantity: booking.quantity, unit: booking.billingUnit })}</DetailRow>
      )}
      {booking.actualQuantity !== null && (
        <DetailRow label={t("actual")}>{t("quantity", { quantity: booking.actualQuantity, unit: booking.billingUnit })}</DetailRow>
      )}
      <DetailRow label={t("when")}>{t("timeRange", { start, end })}</DetailRow>
      <DetailRow label={t("fieldAddress")}>{booking.fieldAddress ?? t("noFieldAddress")}</DetailRow>
      <DetailRow label={t("distance")}>{t("distanceValue", { km: booking.distanceKm })}</DetailRow>
      {booking.note && <DetailRow label={t("note")}>{booking.note}</DetailRow>}
    </dl>
  );
}
