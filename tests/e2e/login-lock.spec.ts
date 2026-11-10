// End-to-end test: 5 wrong passwords for one mobile number lock it for 15 minutes; after that
// even the right password is refused. A NEW farmer is registered for the test, so the demo
// accounts are never locked.
// The browser sends a made-up connection address (from a range kept for examples, 198.51.100.x):
// on our own computer the server believes this header, so the test's wrong tries count for that
// made-up connection and never lock this computer. (On Vercel, Vercel writes the header itself.)
import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomPhone } from "./helpers";

const PASSWORD = "secret123";

/** A new browser window that says it comes from a made-up connection address. */
async function newWindow(browser: Browser, address: string): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": address } });
  return context.newPage();
}

/** Types a mobile number and a password on the login page and presses "Log in". */
async function tryLogin(page: Page, phone: string, password: string): Promise<void> {
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("5 wrong passwords lock the mobile number, even for the right password", async ({ browser }) => {
  const address = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  const phone = randomPhone();

  // A new farmer registers (and is logged in at once).
  const registerPage = await newWindow(browser, address);
  await registerPage.goto("/en/register");
  await registerPage.getByLabel("Full name").fill("Lock Test Farmer");
  await registerPage.getByLabel("Mobile number").fill(phone);
  await registerPage.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await registerPage.getByLabel("Confirm password").fill(PASSWORD);
  await registerPage.getByRole("button", { name: "Create account" }).click();
  await expect(registerPage).toHaveURL(/\/en\/farmer$/);
  await registerPage.context().close();

  // In a new window (not logged in): 5 wrong passwords, each answered "wrong".
  const page = await newWindow(browser, address);
  await page.goto("/en/login");
  for (let attempt = 1; attempt <= 5; attempt++) {
    await tryLogin(page, phone, `wrong-${attempt}-pass`);
    await expect(page.getByText("Wrong mobile number or password")).toBeVisible();
  }

  // Now the number is locked: even the right password is refused, with a clear message.
  await tryLogin(page, phone, PASSWORD);
  await expect(page.getByText(/Too many wrong tries/)).toBeVisible();
  await expect(page).toHaveURL(/\/en\/login/);
  await page.context().close();
});
