// End-to-end test of the main flow, from a new farmer to a reviewed job:
//   register -> book -> provider accepts -> provider sends an operator -> the operator starts
//   with the farmer's START code and finishes with the FINISH code -> the farmer pays -> review.
// Three people take part, so the test opens three separate browser windows (farmer, provider,
// operator), each with its own login. It uses the demo provider and operator from the seed
// (`npm run db:seed`) and registers a NEW farmer every run, so it can be run again and again.
import { expect, test, type Page } from "@playwright/test";
import { DEMO_PHONES, openPageAs, randomPhone } from "./helpers";

/** The machine of the demo provider (Jamal Krishi Seba) that the farmer books. */
const MACHINE_NAME = "Mahindra 575 DI";
/** The demo operator, who works for the demo provider. */
const OPERATOR_NAME = "Selim Mia";

/**
 * A day 30 to 58 days from now, as "YYYY-MM-DD" in Bangladesh time. The day is picked at random,
 * so two runs of this test almost never ask for the same machine at the same time.
 */
function randomFutureDay(): string {
  const daysAhead = 30 + Math.floor(Math.random() * 29);
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(date); // en-CA writes YYYY-MM-DD
}

/** The search page's address for 66 decimal of tilling near Haripur (Paba) on the given day. */
function searchAddress(day: string): string {
  const query = new URLSearchParams({
    workType: "TILLING",
    machineTypeId: "",
    landValue: "66",
    landUnit: "DECIMAL",
    hoursOrDays: "2",
    day,
    lat: "24.45",
    lng: "88.62",
    maxKm: "15",
    sort: "nearest",
  });
  return `/en/farmer/search?${query}`;
}

/** Reads the 4-digit code shown on the farmer's booking page. */
async function readCode(farmerPage: Page): Promise<string> {
  await farmerPage.reload();
  const code = (await farmerPage.getByTestId("otp-code").innerText()).trim();
  expect(code).toMatch(/^\d{4}$/);
  return code;
}

test("a new farmer books a machine, the job is done with both codes, paid and reviewed", async ({ browser }) => {
  // ── 1. Register a new farmer ──
  const farmerPhone = randomPhone();
  const farmerContext = await browser.newContext();
  const farmerPage = await farmerContext.newPage();
  await farmerPage.goto("/en/register");
  await farmerPage.getByLabel("Full name").fill("Test Farmer");
  await farmerPage.getByLabel("Mobile number").fill(farmerPhone);
  await farmerPage.getByLabel("Password", { exact: true }).fill("secret123");
  await farmerPage.getByLabel("Confirm password").fill("secret123");
  await farmerPage.getByRole("button", { name: "Create account" }).click();
  await expect(farmerPage).toHaveURL(/\/en\/farmer$/); // logged in at once, on the farmer dashboard

  // ── 2. Search, open the machine and book it (3 steps) ──
  await farmerPage.goto(searchAddress(randomFutureDay()));
  await farmerPage.getByRole("link", { name: new RegExp(MACHINE_NAME) }).first().click();
  await farmerPage.getByRole("link", { name: "Book this machine" }).click();

  // Step 1: the job is already filled in from the search (66 decimal of tilling).
  await expect(farmerPage.getByRole("heading", { name: "Your job" })).toBeVisible();
  await farmerPage.getByRole("button", { name: "Next" }).click();
  // Step 2: choose the first start time that is still free.
  await expect(farmerPage.getByRole("heading", { name: "Day and time" })).toBeVisible();
  await farmerPage.locator('input[name="startHour"]:not([disabled])').first().check({ force: true });
  await farmerPage.getByRole("button", { name: "Next" }).click();
  // Step 3: check and book.
  await expect(farmerPage.getByRole("heading", { name: "Check and book" })).toBeVisible();
  await farmerPage.getByRole("button", { name: "Book now" }).click();

  // The farmer lands on the new booking's page.
  await expect(farmerPage).toHaveURL(/\/en\/farmer\/bookings\/[a-z0-9]+$/);
  await expect(farmerPage.getByText("Requested").first()).toBeVisible();
  const bookingId = farmerPage.url().split("/").pop()!;

  // ── 3. The provider accepts and sends an operator ──
  const providerPage = await openPageAs(browser, DEMO_PHONES.provider);
  await providerPage.goto(`/en/provider/bookings/${bookingId}`);
  await providerPage.getByRole("button", { name: "Accept" }).click();
  await expect(providerPage.getByRole("button", { name: "Send this operator" })).toBeVisible();
  await providerPage.getByText(OPERATOR_NAME).first().click();
  await providerPage.getByRole("button", { name: "Send this operator" }).click();
  // Wait for the server's answer. (The words "Operator assigned" are no proof: the timeline
  // shows them in grey as a step still to come, even before the operator is saved.)
  await expect(providerPage.getByText("Operator sent. They got the job by SMS.")).toBeVisible();
  await expect(providerPage.getByRole("button", { name: "Send this operator" })).toBeHidden();

  // ── 4. The operator goes to the field and starts with the farmer's START code ──
  const operatorPage = await openPageAs(browser, DEMO_PHONES.operator);
  await operatorPage.goto(`/en/operator/jobs/${bookingId}`);
  await operatorPage.getByRole("button", { name: "I am on the way" }).click();
  await operatorPage.getByRole("button", { name: "I have arrived" }).click();

  const startCode = await readCode(farmerPage);
  await operatorPage.getByLabel("Start code").fill(startCode);
  await operatorPage.getByRole("button", { name: "Start the work" }).click();
  await expect(operatorPage.getByRole("button", { name: "Finish the work" })).toBeVisible();

  // ── 5. The operator finishes with the FINISH code (the land worked stays 66 decimal) ──
  const finishCode = await readCode(farmerPage);
  expect(finishCode).not.toBe(""); // the farmer now sees the finish code instead of the start code
  await operatorPage.getByLabel("Finish code").fill(finishCode);
  await operatorPage.getByRole("button", { name: "Finish the work" }).click();
  await expect(operatorPage.getByText("Work finished. The final bill was sent to the farmer.")).toBeVisible();
  await expect(operatorPage.getByRole("button", { name: "Finish the work" })).toBeHidden();

  // ── 6. The farmer pays online through the test gateway ──
  await farmerPage.reload();
  await farmerPage.getByRole("button", { name: /^Pay .* Tk online$/ }).click();
  await expect(farmerPage).toHaveURL(/\/farmer\/payments\/mock/);
  await farmerPage.getByRole("button", { name: /^Pay .* Tk$/ }).click();
  await expect(farmerPage.getByRole("heading", { name: "Payment successful" })).toBeVisible();

  // ── 7. The farmer reviews the machine and the operator ──
  // The review form only shows on a PAID booking, so seeing it proves the payment was saved.
  await farmerPage.goto(`/en/farmer/bookings/${bookingId}`);
  await expect(farmerPage.getByText("How was the work?", { exact: true })).toBeVisible();
  // Each of the two star rows has a "5 stars" choice: the first is the machine, the second the operator.
  // (The stars work like radio buttons, so screen readers hear "5 stars, selected".)
  await farmerPage.getByRole("radio", { name: "5 stars" }).first().click();
  await farmerPage.getByRole("radio", { name: "5 stars" }).nth(1).click();
  await farmerPage.getByRole("button", { name: "Send review" }).click();
  await expect(farmerPage.getByText("Thank you for your review!")).toBeVisible();
  await expect(farmerPage.getByRole("button", { name: "Send review" })).toBeHidden();

  await farmerContext.close();
});
