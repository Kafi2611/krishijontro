/**
 * Payment gateways — how a farmer pays online.
 *
 * A payment gateway is the company that takes the farmer's money (card, bKash, Nagad...) and
 * tells us if it worked. The payment service (payment.ts) only uses the PaymentGateway
 * interface below, so it does not care WHICH gateway is behind it:
 *   - MockGateway (this file): a pretend bank page inside our own app, for local development
 *     and the demo. No keys and no internet needed; you choose "pay", "fail" or "cancel".
 *   - SslCommerzGateway (sslcommerz.ts): the SSLCommerz sandbox, a real test gateway.
 * Which one NEW payments use is set in .env (PAYMENT_GATEWAY), see getOnlineGateway().
 *
 * Every gateway does three jobs:
 *   1. startPayment: "here is an order" -> the address of the page where the farmer pays
 *   2. checkPayment: "did this payment really happen?" (never trust only what the browser says)
 *   3. refund:       give money back to the farmer
 */
import type { PaymentMethod } from "@/generated/prisma/enums";
import { readSslCommerzConfig, SslCommerzGateway } from "@/lib/services/sslcommerz";

/** The online ways to pay (cash does not go through a gateway). */
export type OnlineMethod = Exclude<PaymentMethod, "CASH">;

/** What the gateway needs to know about one payment. */
export type PaymentOrder = {
  transactionId: string; // our own id, e.g. PAY-KJ-2026-000023-7F3A9C
  amount: number; // whole taka
  productName: string; // e.g. "Tractor work KJ-2026-000023"
  customer: { name: string; phone: string };
  locale: string; // "en" or "bn", so the farmer comes back to a page in their language
};

/** Where to send the farmer to pay, or { ok: false } if the gateway did not answer. */
export type StartPaymentResult = { ok: true; redirectUrl: string } | { ok: false };

/** What we ask the gateway when it says a payment worked. */
export type CheckPaymentRequest = {
  transactionId: string;
  validationId: string; // the gateway's proof (SSLCommerz val_id)
  expectedAmount: number;
};

/**
 * The gateway's answer: valid (with its own id for the payment), or not valid.
 * tryAgain = the gateway could not be reached, so we do not know yet (the payment stays PENDING).
 */
export type CheckedPayment =
  | { valid: true; transactionId: string; amount: number; gatewayRef: string }
  | { valid: false; tryAgain: boolean };

/** Giving back (part of) a payment. */
export type GatewayRefundRequest = {
  refundId: string; // our own id for this refund
  gatewayRef: string | null; // the gateway's id of the payment (saved when it was paid)
  amount: number;
  reason: string;
};

/** The methods every gateway has (see the top of this file). */
export interface PaymentGateway {
  readonly method: OnlineMethod;
  startPayment(order: PaymentOrder): Promise<StartPaymentResult>;
  checkPayment(request: CheckPaymentRequest): Promise<CheckedPayment>;
  refund(request: GatewayRefundRequest): Promise<{ ok: boolean }>;
}

// ─────────────────────────── The pretend gateway ───────────────────────────

/**
 * The pretend gateway for local development. Its "bank page" is our own page
 * /farmer/payments/mock, where the farmer presses Pay, Fail or Cancel.
 */
export class MockGateway implements PaymentGateway {
  readonly method = "MOCK" as const;

  /** Sends the farmer to the pretend bank page of our app. */
  async startPayment(order: PaymentOrder): Promise<StartPaymentResult> {
    const tran = encodeURIComponent(order.transactionId);
    return { ok: true, redirectUrl: `/${order.locale}/farmer/payments/mock?tran=${tran}` };
  }

  /**
   * Always "valid": the pretend bank page is part of our app, and only the farmer who owns
   * the payment can press its Pay button (finishMockPayment in payment.ts checks that).
   */
  async checkPayment(request: CheckPaymentRequest): Promise<CheckedPayment> {
    return {
      valid: true,
      transactionId: request.transactionId,
      amount: request.expectedAmount,
      gatewayRef: request.validationId,
    };
  }

  /** Pretend money always goes back at once. */
  async refund(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

// ─────────────────────────── Choosing a gateway ───────────────────────────

/**
 * The gateway of an existing payment. A payment is always checked and refunded by the SAME
 * gateway that took it (saved in Payment.method), even if .env has changed since.
 * Throws if it is SSLCommerz but its keys are missing from .env (a setup mistake).
 */
export function getGateway(method: OnlineMethod): PaymentGateway {
  if (method === "MOCK") {
    return new MockGateway();
  }
  const config = readSslCommerzConfig();
  if (!config) {
    throw new Error("SSLCommerz is not set up: add SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD to .env");
  }
  return new SslCommerzGateway(config);
}

/**
 * The gateway for a NEW online payment: SSLCommerz if .env says PAYMENT_GATEWAY="sslcommerz"
 * and its keys are there, otherwise the pretend gateway (so the app always works locally).
 */
export function getOnlineGateway(): PaymentGateway {
  const config = readSslCommerzConfig();
  if (process.env.PAYMENT_GATEWAY === "sslcommerz" && config) {
    return new SslCommerzGateway(config);
  }
  return new MockGateway();
}
