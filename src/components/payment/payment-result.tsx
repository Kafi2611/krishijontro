// The result of an online payment try, shown on the success and the failed pages.
// It shows what the DATABASE says about the payment, never what the page address says
// (anybody can type ".../success" in the address bar):
//   SUCCESS -> green tick, the amount, the receipt and the booking
//   PENDING -> "we are still checking" (the gateway has not confirmed yet)
//   FAILED / CANCELLED -> "no money was taken", and a button back to the booking to try again
import { CircleCheckBig, CircleX, Clock, Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PaymentStatus } from "@/generated/prisma/enums";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type PaymentResultProps = {
  payment: {
    transactionId: string;
    amount: number;
    status: PaymentStatus;
    booking: { id: string; code: string };
  };
};

export function PaymentResult({ payment }: PaymentResultProps) {
  const t = useTranslations("PaymentResult");
  const locale = useLocale();
  const { booking } = payment;
  const code = localizeDigits(booking.code, locale);

  const isPaid = payment.status === "SUCCESS";
  const isChecking = payment.status === "PENDING";

  let Icon = CircleX;
  let title = t("failedTitle");
  let text = t("failedText", { status: payment.status });
  if (isPaid) {
    Icon = CircleCheckBig;
    title = t("successTitle");
    text = t("successText", { amount: payment.amount, code });
  } else if (isChecking) {
    Icon = Clock;
    title = t("pendingTitle");
    text = t("pendingText");
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="space-y-5 text-center">
        <span
          className={cn(
            "mx-auto flex size-16 items-center justify-center rounded-full",
            isPaid && "bg-green-100 text-green-700",
            isChecking && "bg-amber-100 text-amber-800",
            !isPaid && !isChecking && "bg-red-100 text-red-700",
          )}
        >
          <Icon className="size-8" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p>{text}</p>
          <p className="text-xs break-all text-muted-foreground">
            {t("transaction", { id: localizeDigits(payment.transactionId, locale) })}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {isPaid && (
            <Button asChild size="lg">
              {/* A plain link, because the receipt is a PDF file, not a page */}
              <a href={`/${locale}/farmer/bookings/${booking.id}/receipt`} download>
                <Download aria-hidden />
                {t("receipt")}
              </a>
            </Button>
          )}
          <Button asChild size="lg" variant={isPaid ? "outline" : "default"}>
            <Link href={`/farmer/bookings/${booking.id}`}>{isPaid || isChecking ? t("openBooking") : t("tryAgain")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
