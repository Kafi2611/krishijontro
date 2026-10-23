/**
 * SSLCommerz gateway — online payment through the SSLCommerz SANDBOX (test money only).
 * Docs: https://developer.sslcommerz.com/doc/v4/
 *
 * How one payment goes:
 *   1. startPayment: we send the order to SSLCommerz. It answers with GatewayPageURL.
 *   2. The farmer's browser goes to that page and pays with a test card or test bKash.
 *   3. SSLCommerz sends the browser back to OUR address /api/payment/sslcommerz/success
 *      (or /fail, /cancel) with tran_id (our id) and val_id (its proof).
 *   4. checkPayment: we ask SSLCommerz, server to server, "is this val_id really paid?".
 *      Only that answer counts, because anybody could send a fake "success" to our address.
 * SSLCommerz also sends an IPN (instant payment notification) straight to our server, in case
 * the farmer closes the browser before step 3. That needs a public address, so it only
 * works on a deployed site, not on localhost.
 *
 * The functions that build the request and read the answers are pure (no internet),
 * so the unit tests can check them.
 */
import type {
  CheckedPayment,
  CheckPaymentRequest,
  GatewayRefundRequest,
  PaymentGateway,
  PaymentOrder,
  StartPaymentResult,
} from "@/lib/services/payment-gateway";

/** The SSLCommerz settings from .env. */
export type SslCommerzConfig = {
  storeId: string;
  storePassword: string;
  sandbox: boolean; // true = test money (sandbox.sslcommerz.com)
  appUrl: string; // our site's address, e.g. http://localhost:3000 (for the return addresses)
};

/** Wait at most this long for SSLCommerz to answer. */
const TIMEOUT_MS = 15_000;

/**
 * Reads the SSLCommerz settings from .env, or null if the store id or password is missing.
 * SSLCOMMERZ_SANDBOX is "true" unless it is set to "false" (we never want real money by mistake).
 */
export function readSslCommerzConfig(env: Record<string, string | undefined> = process.env): SslCommerzConfig | null {
  const storeId = env.SSLCOMMERZ_STORE_ID;
  const storePassword = env.SSLCOMMERZ_STORE_PASSWORD;
  if (!storeId || !storePassword) {
    return null;
  }
  return {
    storeId,
    storePassword,
    sandbox: env.SSLCOMMERZ_SANDBOX !== "false",
    appUrl: (env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""), // without a "/" at the end
  };
}

/** The SSLCommerz server: the sandbox (test) or the live one. */
export function getSslCommerzBaseUrl(config: SslCommerzConfig): string {
  return config.sandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";
}

/**
 * The form we send to SSLCommerz to open a payment page (step 1).
 * value_a is a free field SSLCommerz sends back to us: we put the language in it.
 */
export function buildSessionForm(order: PaymentOrder, config: SslCommerzConfig): URLSearchParams {
  const returnUrl = `${config.appUrl}/api/payment/sslcommerz`;
  return new URLSearchParams({
    store_id: config.storeId,
    store_passwd: config.storePassword,
    total_amount: String(order.amount),
    currency: "BDT",
    tran_id: order.transactionId,
    success_url: `${returnUrl}/success`,
    fail_url: `${returnUrl}/fail`,
    cancel_url: `${returnUrl}/cancel`,
    ipn_url: `${returnUrl}/ipn`,
    product_name: order.productName,
    product_category: "Agricultural machine service",
    product_profile: "non-physical-goods",
    shipping_method: "NO",
    num_of_item: "1",
    cus_name: order.customer.name,
    // SSLCommerz needs an e-mail address, but our farmers log in with a phone number.
    cus_email: `${order.customer.phone}@krishijontro.app`,
    cus_phone: order.customer.phone,
    cus_add1: "Bangladesh",
    cus_city: "Bangladesh",
    cus_country: "Bangladesh",
    value_a: order.locale,
  });
}

/**
 * Reads SSLCommerz's answer to step 1: the payment page address, or { ok: false }.
 * Example answer: { status: "SUCCESS", GatewayPageURL: "https://sandbox.sslcommerz.com/..." }
 */
export function readSessionResponse(answer: unknown): StartPaymentResult {
  const data = answer as { status?: string; GatewayPageURL?: string };
  if (data.status === "SUCCESS" && typeof data.GatewayPageURL === "string" && data.GatewayPageURL !== "") {
    return { ok: true, redirectUrl: data.GatewayPageURL };
  }
  return { ok: false };
}

/**
 * Reads SSLCommerz's answer to "is this val_id paid?" (step 4). It is valid only if ALL hold:
 *   - status is VALID (or VALIDATED: already checked once before)
 *   - it is about OUR transaction id
 *   - the amount is the amount we asked for (nobody changed it on the way)
 * Example answer: { status: "VALID", tran_id: "PAY-...", amount: "1517.00", bank_tran_id: "2310..." }
 */
export function readValidationResponse(answer: unknown, request: CheckPaymentRequest): CheckedPayment {
  const data = answer as { status?: string; tran_id?: string; amount?: string; bank_tran_id?: string };
  const isPaid = data.status === "VALID" || data.status === "VALIDATED";
  // The amount comes as text like "1517.00"; we keep whole taka.
  const amount = Math.round(Number(data.amount));
  if (!isPaid || data.tran_id !== request.transactionId || amount !== request.expectedAmount) {
    return { valid: false, tryAgain: false };
  }
  return { valid: true, transactionId: request.transactionId, amount, gatewayRef: data.bank_tran_id ?? "" };
}

/**
 * Reads SSLCommerz's answer to a refund request. "success" and "processing" both mean
 * SSLCommerz accepted it (the bank may take a few days to send the money).
 */
export function readRefundResponse(answer: unknown): { ok: boolean } {
  const data = answer as { APIConnect?: string; status?: string };
  const accepted = data.status === "success" || data.status === "processing";
  return { ok: data.APIConnect === "DONE" && accepted };
}

/** The SSLCommerz sandbox (or live) gateway. See the top of this file for the steps. */
export class SslCommerzGateway implements PaymentGateway {
  readonly method = "SSLCOMMERZ" as const;
  private readonly config: SslCommerzConfig;

  constructor(config: SslCommerzConfig) {
    this.config = config;
  }

  /** Step 1: opens a payment session. Returns { ok: false } if SSLCommerz did not answer well. */
  async startPayment(order: PaymentOrder): Promise<StartPaymentResult> {
    try {
      const response = await fetch(`${getSslCommerzBaseUrl(this.config)}/gwprocess/v4/api.php`, {
        method: "POST",
        body: buildSessionForm(order, this.config),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return readSessionResponse(await response.json());
    } catch (error) {
      console.error("SSLCommerz session failed", error);
      return { ok: false };
    }
  }

  /** Step 4: asks SSLCommerz whether val_id is really paid. */
  async checkPayment(request: CheckPaymentRequest): Promise<CheckedPayment> {
    const query = new URLSearchParams({
      val_id: request.validationId,
      store_id: this.config.storeId,
      store_passwd: this.config.storePassword,
      format: "json",
    });
    try {
      const url = `${getSslCommerzBaseUrl(this.config)}/validator/api/validationserverAPI.php?${query}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      return readValidationResponse(await response.json(), request);
    } catch (error) {
      // No answer: we do not know yet if it was paid, so the payment stays PENDING.
      console.error("SSLCommerz validation failed", error);
      return { valid: false, tryAgain: true };
    }
  }

  /** Asks SSLCommerz to give (part of) a payment back. It needs the bank_tran_id saved at payment. */
  async refund(request: GatewayRefundRequest): Promise<{ ok: boolean }> {
    if (!request.gatewayRef) {
      return { ok: false };
    }
    const query = new URLSearchParams({
      bank_tran_id: request.gatewayRef,
      refund_trans_id: request.refundId,
      refund_amount: String(request.amount),
      refund_remarks: request.reason,
      store_id: this.config.storeId,
      store_passwd: this.config.storePassword,
      format: "json",
    });
    try {
      const url = `${getSslCommerzBaseUrl(this.config)}/validator/api/merchantTransIDvalidationAPI.php?${query}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      return readRefundResponse(await response.json());
    } catch (error) {
      console.error("SSLCommerz refund failed", error);
      return { ok: false };
    }
  }
}
