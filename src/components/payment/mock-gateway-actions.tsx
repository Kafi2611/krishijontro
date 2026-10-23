"use client";
// The three buttons on the pretend bank page (MockGateway): Pay, Make it fail, Cancel.
// They let you try every ending of an online payment without a real gateway.
// After the server has saved the outcome, the farmer goes to the success or failed page,
// just like coming back from SSLCommerz.
import { CircleX, CreditCard, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { finishMockPaymentAction } from "@/lib/actions/payment";
import { useRouter } from "@/lib/navigation";
import type { MockOutcome } from "@/lib/services/payment";

type MockGatewayActionsProps = {
  transactionId: string;
  amount: number;
};

export function MockGatewayActions({ transactionId, amount }: MockGatewayActionsProps) {
  const t = useTranslations("MockGateway");
  const tError = useTranslations("Validation");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /** Saves the chosen outcome, then opens the result page. */
  function finish(outcome: MockOutcome) {
    startTransition(async () => {
      const result = await finishMockPaymentAction(transactionId, outcome);
      if (!result.ok) {
        toast.error(tError(result.error));
        return;
      }
      const page = outcome === "pay" ? "success" : "failed";
      router.replace(`/farmer/payments/${page}?tran=${encodeURIComponent(transactionId)}`);
    });
  }

  return (
    <div className="grid gap-2">
      <Button size="lg" disabled={isPending} onClick={() => finish("pay")}>
        <CreditCard aria-hidden />
        {t("pay", { amount })}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" disabled={isPending} onClick={() => finish("fail")}>
          <CircleX aria-hidden />
          {t("fail")}
        </Button>
        <Button variant="ghost" size="lg" disabled={isPending} onClick={() => finish("cancel")}>
          <Undo2 aria-hidden />
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
