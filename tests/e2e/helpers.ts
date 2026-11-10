// Small helpers shared by the end-to-end tests.
import { expect, type Browser, type Page } from "@playwright/test";

/** Every demo account from the seed uses this password. */
export const DEMO_PASSWORD = "demo1234";

/** The demo accounts the tests log in with (see prisma/seed.ts). */
export const DEMO_PHONES = {
  farmer: "01700000001",
  coopLeader: "01700000002",
  provider: "01700000003",
  operator: "01700000004",
  admin: "01700000008",
};

/**
 * Logs in through the real login page and waits until the dashboard is shown.
 * Example: await login(page, DEMO_PHONES.provider)
 */
export async function login(page: Page, phone: string, password: string = DEMO_PASSWORD): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  // After a good login the address is no longer the login page.
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Opens a new, separate browser window (its own cookies) and logs a user in.
 * The main flow needs three people at once: the farmer, the provider and the operator.
 */
export async function openPageAs(browser: Browser, phone: string, password: string = DEMO_PASSWORD): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, phone, password);
  return page;
}

/**
 * A new mobile number for each test run (013 + 8 random digits), so "register" always works.
 * Example: "01348271950"
 */
export function randomPhone(): string {
  const digits = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
  return `013${digits}`;
}
