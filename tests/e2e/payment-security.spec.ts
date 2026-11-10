// End-to-end test: the SSLCommerz return addresses need no login, so they must never confirm
// (or fail) a test-gateway payment. Only the farmer who owns it can finish it on the test bank page.
// The test starts a payment for the demo farmer's finished job, tries the "attack" from a
// browser that is not logged in, checks that nothing changed, then cancels the try again
// (so the booking stays ready to pay and the test can run again).
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { DEMO_PHONES, login } from "./helpers";

test("a stranger cannot mark a test-gateway payment as paid or failed", async ({ page, baseURL }) => {
  // 1. The farmer opens a finished job and starts paying online (the test bank page opens).
  await login(page, DEMO_PHONES.farmer);
  await page.goto("/en/farmer/bookings");
  await page.getByRole("link", { name: /Work done/ }).first().click();
  await page.getByRole("button", { name: /^Pay .* Tk online$/ }).click();
  await expect(page).toHaveURL(/\/farmer\/payments\/mock\?tran=/);
  const transactionId = new URL(page.url()).searchParams.get("tran")!;

  // 2. Someone who is NOT logged in posts that transaction id to the SSLCommerz addresses.
  const stranger = await playwrightRequest.newContext({ baseURL });
  const form = { tran_id: transactionId, val_id: "anything", value_a: "en" };
  const success = await stranger.post("/api/payment/sslcommerz/success", { form, maxRedirects: 0 });
  expect(success.status()).toBe(303);
  expect(success.headers().location).toContain("/farmer/payments/failed"); // not "success"
  await stranger.post("/api/payment/sslcommerz/fail", { form, maxRedirects: 0 });
  await stranger.post("/api/payment/sslcommerz/ipn", { form: { ...form, status: "VALID" } });
  await stranger.dispose();

  // 3. Nothing changed: the payment still waits on the test bank page, with its Pay button.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Pay .* Tk$/ })).toBeVisible();

  // 4. Clean up: the farmer cancels this try ("Payment not completed"), and the booking can still be paid.
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("You cancelled the payment.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Back to the booking to try again" }).click();
  await expect(page.getByRole("button", { name: /^Pay .* Tk online$/ })).toBeVisible();
});
