// The payment box on the farmer's booking page.
// - Work done, not paid yet: "Pay online" (the gateway) or pay cash to the operator.
// - Paid: how much, how and when, the PDF receipt, and any money given back (refunds).
// The amounts come from the saved Booking and Payment rows (see lib/services/payment.ts).
import { CircleCheckBig, Download, HandCoins, Wallet } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { PayOnlineButton } from "@/components/payment/pay-online-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BookingStatus, PaymentMethod, PaymentStatus, RefundStatus } from "@/generated/prisma/enums";
import { canPayBooking } from "@/lib/services/payment-rules";

type CardPayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
  refunds: { id: string; amount: number; reason: string; status: RefundStatus }[];
};

type BookingPaymentCardProps = {
  booking: { id: string; status: BookingStatus; totalAmount: number };
  payments: CardPayment[]; // newest first
  onlineMethod: PaymentMethod; // the gateway new payments use (MOCK or SSLCOMMERZ)
};

export function BookingPaymentCard({ booking, payments, onlineMethod }: BookingPaymentCardProps) {
  const t = useTranslations("Payment");
  const tMethod = useTranslations("PaymentMethods");
  const format = useFormatter();
  const locale = useLocale();

  // The first successful payment is THE payment (a second one would be refunded by an admin).
  const paid = payments.findLast((payment) => payment.status === "SUCCESS");

  if (paid) {
    return (
      <Card className="border-green-300 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleCheckBig className="size-5 text-green-700" aria-hidden />
            {t("paidTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            {t("paidText", {
              amount: paid.amount,
              method: tMethod(paid.method),
              date: format.dateTime(paid.paidAt ?? paid.createdAt, { dateStyle: "medium", timeStyle: "short" }),
            })}
          </p>
          {/* A plain link (not <Link>), because the receipt is a PDF file, not a page */}
          <Button asChild variant="outline" size="lg" className="w-full bg-background sm:w-auto">
            <a href={`/${locale}/farmer/bookings/${booking.id}/receipt`} download>
              <Download aria-hidden />
              {t("receipt")}
            </a>
          </Button>
          {paid.refunds.length > 0 && (
            <div className="space-y-2 border-t border-green-200 pt-3">
              <p className="font-semibold">{t("refundsTitle")}</p>
              <ul className="space-y-1 text-sm">
                {paid.refunds.map((refund) => (
                  <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{t("refundLine", { amount: refund.amount, reason: refund.reason })}</span>
                    <StatusBadge status={refund.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!canPayBooking(booking.status)) {
    return null; // the work is not done yet: nothing to pay
  }

  // The latest try, if it did not go through, so the farmer knows why they are asked again.
  const lastTry = payments[0];
  const lastTryFailed = lastTry && (lastTry.status === "FAILED" || lastTry.status === "CANCELLED");

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-5 text-primary" aria-hidden />
          {t("waitingTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>{t("waitingText", { amount: booking.totalAmount })}</p>
        {lastTryFailed && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            {t("lastTryFailed", { status: lastTry.status })}
          </p>
        )}
        <div className="space-y-2">
          <PayOnlineButton bookingId={booking.id} amount={booking.totalAmount} />
          <p className="text-sm text-muted-foreground">
            {onlineMethod === "MOCK" ? t("testGatewayNote") : t("sslcommerzNote")}
          </p>
        </div>
        <div className="flex gap-3 rounded-lg bg-accent p-3">
          <HandCoins className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-semibold">{t("cashTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("cashText")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
