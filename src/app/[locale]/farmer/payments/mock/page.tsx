// Farmer page: the pretend bank page (/farmer/payments/mock?tran=<transaction id>).
// The MockGateway sends the farmer here instead of a real gateway, for local development and
// the demo: no real money is taken. Only the farmer who owns the payment can open it.
import { Landmark } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { MockGatewayActions } from "@/components/payment/mock-gateway-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getFarmerPayment } from "@/lib/services/payment";

type MockGatewayPageProps = {
  searchParams: Promise<{ tran?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MockGateway");
  return { title: t("title") };
}

export default async function MockGatewayPage({ searchParams }: MockGatewayPageProps) {
  const farmer = await requireRole("FARMER");
  const { tran } = await searchParams;
  const payment = tran ? await getFarmerPayment(tran, farmer.id) : null;
  if (!payment || payment.method !== "MOCK") {
    notFound();
  }

  const t = await getTranslations("MockGateway");
  const tPrice = await getTranslations("Price");
  const locale = await getLocale();
  const { booking } = payment;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sky-100 text-sky-800">
            <Landmark className="size-7" aria-hidden />
          </span>
          <CardTitle className="text-xl">{t("bankName")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("text")}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="space-y-2 rounded-lg bg-muted p-4">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("booking")}</dt>
              <dd className="font-medium">{localizeDigits(booking.code, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("machine")}</dt>
              <dd className="font-medium">
                {booking.machine.brand} {booking.machine.model}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-2">
              <dt className="font-semibold">{t("amount")}</dt>
              <dd className="text-2xl font-bold text-primary tabular-nums">{tPrice("amount", { amount: payment.amount })}</dd>
            </div>
          </dl>

          {payment.status === "PENDING" ? (
            <MockGatewayActions transactionId={payment.transactionId} amount={payment.amount} />
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-muted-foreground">{t("notPending")}</p>
              <Button asChild variant="outline">
                <Link href={`/farmer/bookings/${booking.id}`}>{t("back")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
