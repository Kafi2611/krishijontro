// End-to-end test: every page is sent with the safety headers from next.config.ts.
import { expect, test } from "@playwright/test";

test("pages are sent with the safety headers", async ({ request }) => {
  for (const path of ["/en", "/bn/login", "/en/price-calculator"]) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toContain("geolocation=(self)");
    expect(headers["x-powered-by"], path).toBeUndefined();
  }
});
