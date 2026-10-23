// Unit tests for src/lib/services/payment-rules.ts: the transaction id, which bookings can be
// paid, how much can still be refunded, and what KrishiJontro owes the provider.
import { describe, expect, it } from "vitest";
import {
  canPayBooking,
  getBookingMoney,
  getRefundableAmount,
  makeTransactionId,
  sumAmounts,
  type MoneyBooking,
} from "@/lib/services/payment-rules";

describe("makeTransactionId", () => {
  it("starts with PAY and the booking code, and ends with 6 random letters/digits", () => {
    expect(makeTransactionId("KJ-2026-000023")).toMatch(/^PAY-KJ-2026-000023-[0-9A-F]{6}$/);
  });

  it("gives a new id for every payment try", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(makeTransactionId("KJ-2026-000023"));
    }
    expect(ids.size).toBe(50);
  });
});

describe("canPayBooking", () => {
  it("lets the farmer pay only when the work is done", () => {
    expect(canPayBooking("COMPLETED")).toBe(true);
    expect(canPayBooking("WORKING")).toBe(false); // not finished yet
    expect(canPayBooking("PAID")).toBe(false); // already paid
    expect(canPayBooking("REQUESTED")).toBe(false);
  });
});

describe("refund amounts", () => {
  it("adds up a list of amounts", () => {
    expect(sumAmounts([{ amount: 200 }, { amount: 117 }])).toBe(317);
    expect(sumAmounts([])).toBe(0);
  });

  it("can give back what was paid minus what was already refunded", () => {
    expect(getRefundableAmount(1517, [])).toBe(1517);
    expect(getRefundableAmount(1517, [{ amount: 200 }])).toBe(1317);
    expect(getRefundableAmount(1517, [{ amount: 1000 }, { amount: 517 }])).toBe(0);
  });

  it("never goes below 0", () => {
    expect(getRefundableAmount(100, [{ amount: 150 }])).toBe(0);
  });
});

describe("getBookingMoney", () => {
  // The project's price example: work 1584, delivery 250, fee 55 -> share 1779; the farmer pays 1517.
  const example: MoneyBooking = {
    workCharge: 1584,
    deliveryCharge: 250,
    platformFee: 55,
    payments: [],
    refunds: [],
  };

  it("owes the whole share when the farmer paid online", () => {
    const money = getBookingMoney({ ...example, payments: [{ method: "SSLCOMMERZ", status: "SUCCESS", amount: 1517 }] });
    expect(money).toEqual({ share: 1779, cashTaken: 0, refunded: 0, owed: 1779 });
  });

  it("owes only the rest after a cash payment (the subsidy minus our fee)", () => {
    const money = getBookingMoney({ ...example, payments: [{ method: "CASH", status: "SUCCESS", amount: 1517 }] });
    expect(money.cashTaken).toBe(1517);
    expect(money.owed).toBe(262); // 317 subsidy − 55 fee
  });

  it("can be below 0 for a cash job without subsidy: the provider holds our fee", () => {
    const money = getBookingMoney({ ...example, payments: [{ method: "CASH", status: "SUCCESS", amount: 1834 }] });
    expect(money.owed).toBe(-55);
  });

  it("takes refunds out of the provider's share", () => {
    const money = getBookingMoney({
      ...example,
      payments: [{ method: "MOCK", status: "SUCCESS", amount: 1517 }],
      refunds: [{ amount: 200 }],
    });
    expect(money.refunded).toBe(200);
    expect(money.owed).toBe(1579);
  });

  it("does not count failed tries as cash", () => {
    const money = getBookingMoney({
      ...example,
      payments: [
        { method: "MOCK", status: "FAILED", amount: 1517 },
        { method: "MOCK", status: "SUCCESS", amount: 1517 },
      ],
    });
    expect(money.owed).toBe(1779);
  });
});
