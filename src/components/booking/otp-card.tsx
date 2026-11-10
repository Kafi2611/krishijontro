// The farmer's secret code in big digits: the START code until the work begins, then the
// FINISH code while the work goes on (getOtpToShow in lib/services/booking-rules.ts decides).
// The operator must type this code to start / finish, so the farmer stays in control.
// Only the farmer's booking page shows this card; the provider and operator never read the codes.
// If a wrong code was typed 5 times the code is LOCKED: the card then says so and offers
// "Get a new code" instead of showing the old code, which no longer works.
import { KeyRound, LockKeyhole } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { RenewOtpButton } from "@/components/booking/renew-otp-button";
import { Card, CardContent } from "@/components/ui/card";
import { localizeDigits } from "@/lib/i18n";
import { isOtpLocked, MAX_OTP_TRIES } from "@/lib/services/booking-rules";

type OtpCardProps = {
  bookingId: string;
  kind: "start" | "finish";
  code: string; // 4 digits
  wrongTries: number; // how many times a wrong code was typed for this code
};

export function OtpCard({ bookingId, kind, code, wrongTries }: OtpCardProps) {
  const t = useTranslations("BookingView");
  const locale = useLocale();

  if (isOtpLocked(wrongTries)) {
    return (
      <Card className="border-red-300 bg-red-50">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-700 text-white">
            <LockKeyhole className="size-6" aria-hidden />
          </span>
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-red-900">{t("otpLockedTitle")}</p>
            <p className="text-sm text-red-900">{t("otpLockedText", { max: MAX_OTP_TRIES })}</p>
          </div>
          <RenewOtpButton bookingId={bookingId} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary bg-accent">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <KeyRound className="size-6" aria-hidden />
        </span>
        <div className="flex-1 space-y-1">
          <p className="font-semibold">{kind === "start" ? t("otpStartTitle") : t("otpFinishTitle")}</p>
          <p className="text-sm text-muted-foreground">{kind === "start" ? t("otpStartText") : t("otpFinishText")}</p>
          {/* The farmer should know when somebody typed a wrong code */}
          {wrongTries > 0 && (
            <p className="text-sm font-medium text-amber-800">
              {t("otpWrongTries", { count: wrongTries, left: MAX_OTP_TRIES - wrongTries })}
            </p>
          )}
        </div>
        {/* tracking-[0.3em]: wide gaps between the digits, so they are easy to read out.
            data-testid lets the end-to-end test find the code (tests/e2e/main-flow.spec.ts). */}
        <p data-testid="otp-code" className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">
          {localizeDigits(code, locale)}
        </p>
      </CardContent>
    </Card>
  );
}
