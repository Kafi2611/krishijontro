// SSLCommerz's IPN ("instant payment notification"): POST /api/payment/sslcommerz/ipn
// SSLCommerz's own server tells our server about a payment, even if the farmer closed the
// browser before coming back to the success address. It needs a public address, so it works
// on a deployed site only (not on localhost).
// It uses the same confirmOnlinePayment() as the success address, which asks SSLCommerz to
// confirm val_id, and does nothing if the payment was already confirmed.
import { confirmOnlinePayment, failOnlinePayment } from "@/lib/services/payment";

export async function POST(request: Request) {
  const form = await request.formData();
  const transactionId = String(form.get("tran_id") ?? "");
  const validationId = String(form.get("val_id") ?? "");
  const status = String(form.get("status") ?? "");

  if (status === "VALID" || status === "VALIDATED") {
    await confirmOnlinePayment(transactionId, validationId);
  } else if (status === "FAILED" || status === "CANCELLED") {
    await failOnlinePayment(transactionId, status);
  }
  // Always answer "received", so SSLCommerz does not keep sending the same message.
  return Response.json({ received: true });
}
