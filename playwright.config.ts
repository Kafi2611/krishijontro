// Playwright settings for the end-to-end tests in tests/e2e (run them with `npm run test:e2e`).
// An end-to-end test opens a real browser and uses the site like a person would:
// it types into forms, presses buttons and reads what the pages show.
import { defineConfig, devices } from "@playwright/test";

// The tests start their own copy of the site on this port, so they never disturb `npm run dev`.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// On Windows we use the Edge browser that is already installed, so nothing has to be downloaded.
// On other systems run `npx playwright install chromium` once.
const channel = process.platform === "win32" ? "msedge" : undefined;

export default defineConfig({
  testDir: "tests/e2e",
  // All tests use the same database, so they run one after another (not side by side).
  fullyParallel: false,
  workers: 1,
  timeout: 180_000, // the main flow has many steps with a far-away database
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "en-US",
    timezoneId: "Asia/Dhaka",
    trace: "retain-on-failure", // a recording of the steps, kept only when a test fails
    screenshot: "only-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], channel } }],
  // Build the site and start it before the tests (or use the one already running on the port).
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `${baseURL}/en`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
