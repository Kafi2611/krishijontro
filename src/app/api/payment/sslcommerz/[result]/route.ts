// Where SSLCommerz sends the farmer's browser back after the payment page:
//   POST /api/payment/sslcommerz/success | fail | cancel
// with form fields tran_id (our id), val_id (SSLCommerz's proof) and value_a (the language).
// This is a route, not a page, because SSLCommerz sends a POST and a page can only answer a GET.
// We never trust the word "success" in the address: confirmOnlinePayment() asks SSLCommerz
// itself whether val_id is really paid. Then we send the browser on to our result page.
// (The browser comes from another website, so the login cookie is not sent here; that is
// fine, because the payment is found by its transaction id and checked with SSLCommerz.)
import { NextResponse } from "next/server";
import { routing } from "@/lib/i18n";
import { confirmOnlinePayment, failOnlinePayment } from "@/lib/services/payment";

/** The language SSLCommerz sent back in value_a, or the default if it looks wrong. */
function pickLocale(value: FormDataEntryValue | null): string {
  const locales: readonly string[] = routing.locales;
  return typeof value === "string" && locales.includes(value) ? value : routing.defaultLocale;
}

export async function POST(request: Request, { params }: { params: Promise<{ result: string }> }) {
  const { result } = await params;
  const form = await request.formData();
  const transactionId = String(form.get("tran_id") ?? "");
  const validationId = String(form.get("val_id") ?? "");
  const locale = pickLocale(form.get("value_a"));

  let paid = false;
  if (result === "success") {
    const outcome = await confirmOnlinePayment(transactionId, validationId);
    paid = outcome.ok;
  } else if (result === "fail" || result === "cancel") {
    await failOnlinePayment(transactionId, result === "fail" ? "FAILED" : "CANCELLED");
  } else {
    return Response.json({ error: "notFound" }, { status: 404 });
  }

  // 303 "See Other" makes the browser open the result page with a GET (not another POST).
  const page = paid ? "success" : "failed";
  const resultUrl = new URL(`/${locale}/farmer/payments/${page}?tran=${encodeURIComponent(transactionId)}`, request.url);
  return NextResponse.redirect(resultUrl, 303);
}
