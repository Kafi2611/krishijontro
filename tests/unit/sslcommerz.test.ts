// Unit tests for the payment gateways: the pure parts of src/lib/services/sslcommerz.ts (the
// settings, the request we send, how we read SSLCommerz's answers) and the MockGateway.
// No internet is used: the answers below are written like the ones SSLCommerz sends.
import { describe, expect, it } from "vitest";
import { MockGateway } from "@/lib/services/payment-gateway";
import {
  buildSessionForm,
  getSslCommerzBaseUrl,
  readRefundResponse,
  readSessionResponse,
  readSslCommerzConfig,
  readValidationResponse,
  type SslCommerzConfig,
} from "@/lib/services/sslcommerz";

const config: SslCommerzConfig = {
  storeId: "teststore",
  storePassword: "secret",
  sandbox: true,
  appUrl: "http://localhost:3000",
};

const order = {
  transactionId: "PAY-KJ-2026-000023-7F3A9C",
  amount: 1517,
  productName: "Tractor work KJ-2026-000023",
  customer: { name: "Rahim Uddin", phone: "01700000001" },
  locale: "bn",
};

describe("readSslCommerzConfig", () => {
  it("is null when the store id or password is missing (then the pretend gateway is used)", () => {
    expect(readSslCommerzConfig({})).toBeNull();
    expect(readSslCommerzConfig({ SSLCOMMERZ_STORE_ID: "teststore" })).toBeNull();
  });

  it("uses the sandbox unless it is switched off on purpose", () => {
    const keys = { SSLCOMMERZ_STORE_ID: "teststore", SSLCOMMERZ_STORE_PASSWORD: "secret" };
    expect(readSslCommerzConfig(keys)?.sandbox).toBe(true);
    expect(readSslCommerzConfig({ ...keys, SSLCOMMERZ_SANDBOX: "false" })?.sandbox).toBe(false);
  });

  it("removes a / at the end of the site address", () => {
    const keys = { SSLCOMMERZ_STORE_ID: "a", SSLCOMMERZ_STORE_PASSWORD: "b", APP_URL: "https://krishi.example/" };
    expect(readSslCommerzConfig(keys)?.appUrl).toBe("https://krishi.example");
  });
});

describe("buildSessionForm", () => {
  it("sends the amount, our transaction id and our return addresses", () => {
    const form = buildSessionForm(order, config);
    expect(form.get("total_amount")).toBe("1517");
    expect(form.get("currency")).toBe("BDT");
    expect(form.get("tran_id")).toBe(order.transactionId);
    expect(form.get("success_url")).toBe("http://localhost:3000/api/payment/sslcommerz/success");
    expect(form.get("fail_url")).toBe("http://localhost:3000/api/payment/sslcommerz/fail");
    expect(form.get("cancel_url")).toBe("http://localhost:3000/api/payment/sslcommerz/cancel");
  });

  it("keeps the language in value_a, so the farmer comes back in Bangla", () => {
    expect(buildSessionForm(order, config).get("value_a")).toBe("bn");
  });

  it("talks to the sandbox server in test mode", () => {
    expect(getSslCommerzBaseUrl(config)).toBe("https://sandbox.sslcommerz.com");
  });
});

describe("readSessionResponse", () => {
  it("gives the payment page address when SSLCommerz says SUCCESS", () => {
    const answer = { status: "SUCCESS", GatewayPageURL: "https://sandbox.sslcommerz.com/pay/abc" };
    expect(readSessionResponse(answer)).toEqual({ ok: true, redirectUrl: "https://sandbox.sslcommerz.com/pay/abc" });
  });

  it("fails when SSLCommerz says FAILED", () => {
    expect(readSessionResponse({ status: "FAILED", failedreason: "Store Credential Error" })).toEqual({ ok: false });
  });
});

describe("readValidationResponse", () => {
  const request = { transactionId: order.transactionId, validationId: "val123", expectedAmount: 1517 };
  const goodAnswer = { status: "VALID", tran_id: order.transactionId, amount: "1517.00", bank_tran_id: "BANK-991" };

  it("is valid when the status, our transaction id and the amount all match", () => {
    expect(readValidationResponse(goodAnswer, request)).toEqual({
      valid: true,
      transactionId: order.transactionId,
      amount: 1517,
      gatewayRef: "BANK-991",
    });
    expect(readValidationResponse({ ...goodAnswer, status: "VALIDATED" }, request).valid).toBe(true);
  });

  it("is NOT valid when the amount was changed on the way", () => {
    expect(readValidationResponse({ ...goodAnswer, amount: "15.00" }, request)).toEqual({ valid: false, tryAgain: false });
  });

  it("is NOT valid for another transaction or an invalid payment", () => {
    expect(readValidationResponse({ ...goodAnswer, tran_id: "PAY-OTHER" }, request).valid).toBe(false);
    expect(readValidationResponse({ ...goodAnswer, status: "INVALID_TRANSACTION" }, request).valid).toBe(false);
  });
});

describe("readRefundResponse", () => {
  it("accepts success and processing", () => {
    expect(readRefundResponse({ APIConnect: "DONE", status: "success" })).toEqual({ ok: true });
    expect(readRefundResponse({ APIConnect: "DONE", status: "processing" })).toEqual({ ok: true });
  });

  it("refuses a failed refund", () => {
    expect(readRefundResponse({ APIConnect: "DONE", status: "failed" })).toEqual({ ok: false });
    expect(readRefundResponse({ APIConnect: "INVALID_REQUEST" })).toEqual({ ok: false });
  });
});

describe("MockGateway", () => {
  it("sends the farmer to our pretend bank page, in their language", async () => {
    const result = await new MockGateway().startPayment(order);
    expect(result).toEqual({ ok: true, redirectUrl: "/bn/farmer/payments/mock?tran=PAY-KJ-2026-000023-7F3A9C" });
  });

  it("confirms the payment with the expected amount", async () => {
    const checked = await new MockGateway().checkPayment({ transactionId: "T1", validationId: "MOCK-T1", expectedAmount: 900 });
    expect(checked).toEqual({ valid: true, transactionId: "T1", amount: 900, gatewayRef: "MOCK-T1" });
  });
});
