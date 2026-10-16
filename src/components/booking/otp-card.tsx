// The farmer's secret code in big digits: the START code until the work begins, then the
// FINISH code while the work goes on (getOtpToShow in lib/services/booking-rules.ts decides).
// The operator must type this code to start / finish, so the farmer stays in control.
// Only the farmer's booking page shows this card; the provider and operator never read the codes.
import { KeyRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { localizeDigits } from "@/lib/i18n";

type OtpCardProps = {
  kind: "start" | "finish";
  code: string; // 4 digits
};

export function OtpCard({ kind, code }: OtpCardProps) {
  const t = useTranslations("BookingView");
  const locale = useLocale();

  return (
    <Card className="border-primary bg-accent">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <KeyRound className="size-6" aria-hidden />
        </span>
        <div className="flex-1 space-y-1">
          <p className="font-semibold">{kind === "start" ? t("otpStartTitle") : t("otpFinishTitle")}</p>
          <p className="text-sm text-muted-foreground">{kind === "start" ? t("otpStartText") : t("otpFinishText")}</p>
        </div>
        {/* tracking-[0.3em]: wide gaps between the digits, so they are easy to read out */}
        <p className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{localizeDigits(code, locale)}</p>
      </CardContent>
    </Card>
  );
}
