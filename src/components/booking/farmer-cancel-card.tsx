// The "Change of plans?" box on the farmer's booking page, while the booking can still be
// cancelled. It says what cancelling costs right now (cancellation-rules.ts):
// free while the provider has not answered, free until 24 hours before the start, a late fee after.
import { useFormatter, useTranslations } from "next-intl";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BookingStatus } from "@/generated/prisma/enums";
import type { CancellationRules } from "@/lib/services/cancellation-rules";

type FarmerCancelCardProps = {
  bookingId: string;
  status: BookingStatus;
  fee: number; // what cancelling costs right now (0 = free)
  freeUntil: Date; // the last moment it is free
  rules: CancellationRules;
};

export function FarmerCancelCard({ bookingId, status, fee, freeUntil, rules }: FarmerCancelCardProps) {
  const t = useTranslations("Cancel");
  const format = useFormatter();

  let text = t("freeUntil", { time: format.dateTime(freeUntil, { dateStyle: "medium", timeStyle: "short" }) });
  if (status === "REQUESTED") {
    text = t("freeRequested");
  } else if (fee > 0) {
    text = t("feeNow", { fee, percent: rules.feePercent, hours: rules.freeHours });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("farmerTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground">{text}</p>
        <CancelBookingButton bookingId={bookingId} fee={fee} />
      </CardContent>
    </Card>
  );
}
