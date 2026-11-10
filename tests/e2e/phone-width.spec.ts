// End-to-end test: every role's main pages fit on a small phone (360 pixels wide), in English
// and in Bangla. A page "fits" when it does not scroll sideways. (Wide tables and maps are inside
// their own box that may scroll; the page itself must not.)
import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "./helpers";

// Every page is opened at the width of a small Android phone.
test.use({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true });

/** The pages to check for each demo account (null = not logged in). */
const PAGES_BY_ACCOUNT: { role: string; phone: string | null; pages: string[] }[] = [
  { role: "visitor", phone: null, pages: ["", "/price-calculator", "/login", "/register"] },
  { role: "farmer", phone: "01700000001", pages: ["/farmer", "/farmer/search", "/farmer/bookings", "/farmer/subsidy", "/farmer/waitlist", "/notifications", "/support/new"] },
  { role: "cooperative leader", phone: "01700000002", pages: ["/cooperative", "/cooperative/members", "/cooperative/group-bookings", "/cooperative/group-bookings/new"] },
  { role: "provider", phone: "01700000003", pages: ["/provider", "/provider/machines", "/provider/machines/new", "/provider/bookings", "/provider/earnings"] },
  { role: "operator", phone: "01700000004", pages: ["/operator", "/operator/jobs"] },
  { role: "technician", phone: "01700000005", pages: ["/technician", "/technician/requests"] },
  { role: "officer", phone: "01700000006", pages: ["/officer", "/officer/farmers", "/officer/subsidies", "/officer/bookings"] },
  { role: "government", phone: "01700000007", pages: ["/govt", "/govt/pricing", "/govt/reports", "/govt/subsidies"] },
  { role: "admin", phone: "01700000008", pages: ["/admin", "/admin/approvals", "/admin/users", "/admin/bookings", "/admin/payments", "/admin/disputes", "/admin/settings", "/admin/audit"] },
];

/** Logs in through the login API (quicker than typing in the form for every account). */
async function loginQuickly(page: Page, phone: string): Promise<void> {
  const { csrfToken } = await (await page.request.get("/api/auth/csrf")).json();
  await page.request.post("/api/auth/callback/credentials", {
    form: { csrfToken, phone, password: DEMO_PASSWORD, callbackUrl: "/en" },
  });
}

/** How much wider than the screen the page is, in pixels (0 = it fits). */
async function overflowWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const { role, phone, pages } of PAGES_BY_ACCOUNT) {
  test(`the ${role}'s pages fit on a 360 px phone`, async ({ page }) => {
    if (phone) {
      await loginQuickly(page, phone);
    }
    for (const locale of ["en", "bn"]) {
      for (const path of pages) {
        const response = await page.goto(`/${locale}${path}`);
        expect(response?.status(), `${locale}${path} opens`).toBeLessThan(400);
        await page.waitForLoadState("networkidle"); // maps and charts draw a moment later
        expect(await overflowWidth(page), `/${locale}${path} must not scroll sideways`).toBeLessThanOrEqual(1);
      }
    }
  });
}
