// End-to-end test: the cooperative leader's group booking form checks step 1 before going on.
import { expect, test } from "@playwright/test";
import { DEMO_PHONES, login } from "./helpers";

test("the group booking form asks for a machine type before step 2", async ({ page }) => {
  await login(page, DEMO_PHONES.coopLeader);
  await page.goto("/en/cooperative/group-bookings/new");
  await expect(page.getByRole("heading", { name: "The job" })).toBeVisible();

  // Nothing is chosen under "Machine" yet: Next must stay on step 1 and say what is missing.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Choose the machine", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The job" })).toBeVisible();

  // After choosing a machine type the error goes away and Next opens step 2.
  await page.getByText("Power Tiller", { exact: true }).click();
  await expect(page.getByText("Choose the machine", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "The plots" })).toBeVisible();
});
