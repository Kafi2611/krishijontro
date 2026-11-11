// End-to-end tests: what happens to a login when its account changes after the login.
// - The account no longer exists (this happens after `npm run db:seed`, which deletes every
//   account and makes new ones): the browser is simply logged out. It lands on the normal
//   login page WITHOUT the "account is suspended" message, and the old login cookie is removed.
//   To get such a browser, the test makes a login cookie for a made-up account id, signed with
//   the site's own secret (AUTH_SECRET in .env), just like the cookie Auth.js makes at login.
// - An admin really suspends the account: then the login page DOES show the suspended message.
import "dotenv/config"; // loads AUTH_SECRET from .env into process.env
import { expect, test, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { DEMO_PHONES, openPageAs, randomPhone } from "./helpers";

/** The name of the Auth.js login cookie on http://localhost (on https it starts with "__Secure-"). */
const LOGIN_COOKIE = "authjs.session-token";

/** The words the login page shows to a suspended user (messages/en.json, Validation.accountSuspended). */
const SUSPENDED_TEXT = "This account is suspended";

/**
 * Puts an old login into the browser: a login cookie (like jwt() in lib/auth.config.ts makes)
 * for an account id that no account in the database has.
 */
async function addLoginOfDeletedAccount(context: BrowserContext, baseURL: string): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is missing in .env");
  }
  const value = await encode({
    secret,
    salt: LOGIN_COOKIE, // Auth.js uses the cookie name as the salt
    token: { id: "account-deleted-by-seed", name: "Old Farmer", role: "FARMER", phone: "01399999999" },
  });
  await context.addCookies([{ name: LOGIN_COOKIE, value, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}

/** True if the browser still has a login cookie. */
async function hasLoginCookie(context: BrowserContext): Promise<boolean> {
  const cookies = await context.cookies();
  return cookies.some((cookie) => cookie.name === LOGIN_COOKIE);
}

test("opening a dashboard with the login of a deleted account logs out, without the suspended message", async ({
  context,
  page,
  baseURL,
}) => {
  await addLoginOfDeletedAccount(context, baseURL!);

  // The farmer opens their dashboard, as they would after a new seed.
  await page.goto("/en/farmer");

  // The normal login page: no "?suspended" in the address and no suspended message.
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByText(SUSPENDED_TEXT)).toHaveCount(0);

  // The old login is really gone: a page that needs a login now goes the usual way (proxy.ts).
  expect(await hasLoginCookie(context)).toBe(false);
  await page.goto("/en/farmer");
  await expect(page).toHaveURL(/\/en\/login\?callbackUrl=/);
});

test("pressing Log in on the home page with the login of a deleted account opens the normal login page", async ({
  context,
  page,
  baseURL,
}) => {
  await addLoginOfDeletedAccount(context, baseURL!);

  // The home page treats this visitor as logged out, so the navbar shows "Log in".
  await page.goto("/en");
  await page.getByRole("banner").getByRole("link", { name: "Log in" }).click();

  // Before the fix this showed the suspended message. Now it is the normal login page.
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByText(SUSPENDED_TEXT)).toHaveCount(0);
  expect(await hasLoginCookie(context)).toBe(false);
});

test("a farmer the admin really suspends still sees the suspended message", async ({ browser, page }) => {
  // A new farmer registers (and is logged in at once), so no demo account is suspended.
  const phone = randomPhone();
  const password = "secret123";
  await page.goto("/en/register");
  await page.getByLabel("Full name").fill("Suspend Test Farmer");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/farmer$/);

  // In another window the admin finds this farmer and suspends the account.
  const adminPage = await openPageAs(browser, DEMO_PHONES.admin);
  await adminPage.goto(`/en/admin/users?q=${phone}`);
  await adminPage.getByRole("button", { name: "Suspend" }).click();
  await adminPage.getByLabel("Why? (the user is told)").fill("Test of the suspended message");
  await adminPage.getByRole("button", { name: "Suspend the account" }).click();
  await expect(adminPage.getByText("Account suspended. The user is logged out.")).toBeVisible();
  await adminPage.context().close();

  // The farmer's next page sends them to the login page WITH the suspended message.
  await page.goto("/en/farmer");
  await expect(page).toHaveURL(/\/en\/login\?suspended=1$/);
  await expect(page.getByRole("alert").filter({ hasText: SUSPENDED_TEXT })).toBeVisible();
});
