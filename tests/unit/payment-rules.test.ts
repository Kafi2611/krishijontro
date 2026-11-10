// Unit tests for src/lib/services/payment-rules.ts: the transaction id, which bookings can be
// paid, how much can still be refunded, what KrishiJontro owes the provider for one booking, and
// the provider's balance (with a refund or fine after a payout carried forward).
import { describe, expect, it } from "vitest";
import {
  canPayBooking,
  getBookingMoney,
  getProviderBalance,
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
    expect(canPayBooking("COMPLETED", false)).toBe(true);
    expect(canPayBooking("WORKING", false)).toBe(false); // not finished yet
    expect(canPayBooking("PAID", false)).toBe(false); // already paid
    expect(canPayBooking("REQUESTED", false)).toBe(false);
  });

  it("waits while a complaint is open, and allows paying once the admin has decided", () => {
    expect(canPayBooking("DISPUTED", true)).toBe(false);
    expect(canPayBooking("DISPUTED", false)).toBe(true);
  });
});

describe("refund amounts", () => {
  it("adds up a list of amounts", () => {
    expect(sumAmounts([{ amount: 200 }, { amount: 117 }])).toBe(317);
    expect(sumAmounts([])).toBe(0);
  });

  it("can give back what was paid minus what was already refunded", () => {
    expect(getRefundableAmount(1517, [])).toBe(1517);
    expect(getRefundableAmount(1517, [{ amount: 200, status: "PROCESSED" }])).toBe(1317);
    expect(
      getRefundableAmount(1517, [
        { amount: 1000, status: "PROCESSED" },
        { amount: 517, status: "PROCESSED" },
      ]),
    ).toBe(0);
  });

  it("counts a refund that is still pending, so the same money is not given back twice", () => {
    expect(getRefundableAmount(1517, [{ amount: 300, status: "PENDING" }])).toBe(1217);
  });

  it("does not count a failed refund: that money never went back", () => {
    expect(getRefundableAmount(1517, [{ amount: 300, status: "FAILED" }])).toBe(1517);
    expect(
      getRefundableAmount(1517, [
        { amount: 300, status: "FAILED" },
        { amount: 200, status: "PROCESSED" },
      ]),
    ).toBe(1317);
  });

  it("never goes below 0", () => {
    expect(getRefundableAmount(100, [{ amount: 150, status: "PROCESSED" }])).toBe(0);
  });
});

describe("getProviderBalance", () => {
  it("is the total of the waiting bookings when nothing was paid out yet", () => {
    const balance = getProviderBalance(
      [
        { owed: 1779, isPaidOut: false },
        { owed: 262, isPaidOut: false },
      ],
      0,
    );
    expect(balance).toEqual({ waitingTotal: 2041, carriedForward: 0, balance: 2041 });
  });

  it("carries nothing forward when the paid-out bookings are still worth what was sent", () => {
    const balance = getProviderBalance(
      [
        { owed: 1779, isPaidOut: true },
        { owed: 1500, isPaidOut: false },
      ],
      1779,
    );
    expect(balance).toEqual({ waitingTotal: 1500, carriedForward: 0, balance: 1500 });
  });

  it("carries a refund made after the payout forward to the next payout", () => {
    // 1779 was sent for the first booking; then 200 Tk went back to the farmer, so it is worth 1579.
    const balance = getProviderBalance(
      [
        { owed: 1579, isPaidOut: true },
        { owed: 1500, isPaidOut: false },
      ],
      1779,
    );
    expect(balance).toEqual({ waitingTotal: 1500, carriedForward: -200, balance: 1300 });
  });

  it("is even again after that next payout", () => {
    const balance = getProviderBalance(
      [
        { owed: 1579, isPaidOut: true },
        { owed: 1500, isPaidOut: true },
      ],
      1779 + 1300,
    );
    expect(balance).toEqual({ waitingTotal: 0, carriedForward: 0, balance: 0 });
  });

  it("keeps a debt when no new job waits: the balance is below 0 until the provider earns more", () => {
    const balance = getProviderBalance([{ owed: 1479, isPaidOut: true }], 1779); // fined 300 after the payout
    expect(balance).toEqual({ waitingTotal: 0, carriedForward: -300, balance: -300 });
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
    disputes: [],
  };

  it("owes the whole share when the farmer paid online", () => {
    const money = getBookingMoney({ ...example, payments: [{ method: "SSLCOMMERZ", status: "SUCCESS", amount: 1517 }] });
    expect(money).toEqual({ share: 1779, cashTaken: 0, refunded: 0, fined: 0, owed: 1779 });
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

  it("takes a complaint's fine out of the provider's share", () => {
    const money = getBookingMoney({
      ...example,
      payments: [{ method: "SSLCOMMERZ", status: "SUCCESS", amount: 1517 }],
      disputes: [{ penaltyAmount: 300 }],
    });
    expect(money.fined).toBe(300);
    expect(money.owed).toBe(1479);
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
