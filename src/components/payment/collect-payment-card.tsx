// The "Collect the payment" box on the operator's job screen and the provider's booking page,
// shown when the work is done but not paid yet. If the farmer pays in cash, the operator (or
// the provider) presses "Cash received". If the farmer pays online, nobody has to do anything.
import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";
import { CashReceivedButton } from "@/components/payment/cash-received-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CollectPaymentCardProps = {
  bookingId: string;
  amount: number; // what the farmer pays
};

export function CollectPaymentCard({ bookingId, amount }: CollectPaymentCardProps) {
  const t = useTranslations("Payment");
  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="size-5 text-amber-700" aria-hidden />
          {t("collectTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>{t("collectText", { amount })}</p>
        <CashReceivedButton bookingId={bookingId} amount={amount} />
      </CardContent>
    </Card>
  );
}
