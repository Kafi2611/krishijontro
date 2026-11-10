// End-to-end test: the site can be used with the keyboard only (no mouse, no finger).
// The first Tab shows "Skip to main content"; Enter jumps over the menus to the page's content.
import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, DEMO_PHONES } from "./helpers";

test("a farmer logs in with the keyboard only, using the skip link", async ({ page }) => {
  await page.goto("/en/login");

  // 1. The first Tab reaches the skip link, which becomes visible.
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  // 2. Enter jumps to the page's content; the next Tab reaches the first box of the form.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Mobile number")).toBeFocused();

  // 3. Type the number, Tab to the password, type it, and press Enter to log in.
  await page.keyboard.type(DEMO_PHONES.farmer);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.type(DEMO_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/farmer$/);

  // 4. On a freshly opened dashboard the skip link is again the first stop.
  await page.goto("/en/farmer");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});
