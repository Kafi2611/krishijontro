// End-to-end test: a big phone photo is made smaller in the browser before it is uploaded,
// and a file that is too big (and is not a photo) gets a clear message.
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_PHONES, login } from "./helpers";

const FOUR_MB = 4 * 1024 * 1024;

/**
 * Draws a 4000 × 3000 "photo" in the browser and saves it as a high-quality JPEG, like a phone
 * camera does. Every pixel gets a random colour ("noise"), which is very hard to compress, so the
 * file is well over 4 MB. Returns the file's bytes.
 */
async function makeBigPhoto(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 3000;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(4000, 3000);
    for (let index = 0; index < pixels.data.length; index += 4) {
      pixels.data[index] = Math.random() * 255; // red
      pixels.data[index + 1] = Math.random() * 255; // green
      pixels.data[index + 2] = Math.random() * 255; // blue
      pixels.data[index + 3] = 255; // not see-through
    }
    context.putImageData(pixels, 0, 0);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((made) => resolve(made!), "image/jpeg", 0.95));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return Buffer.from(bytes);
}

test.beforeEach(async ({ page }) => {
  await login(page, DEMO_PHONES.provider);
  await page.goto("/en/provider/machines/new");
});

test("a big phone photo is made smaller and uploaded", async ({ page }) => {
  const photo = await makeBigPhoto(page);
  expect(photo.length).toBeGreaterThan(FOUR_MB); // bigger than the server allows

  // Pick the photo, and catch the server's answer: it says where the saved photo is.
  const uploadAnswer = page.waitForResponse((response) => response.url().endsWith("/api/upload"));
  await page.locator('input[type="file"]').setInputFiles({ name: "IMG_2041.jpg", mimeType: "image/jpeg", buffer: photo });
  const answer = await uploadAnswer;
  expect(answer.status()).toBe(200);
  const { url } = (await answer.json()) as { url: string };

  // The saved photo is a small JPEG: read it from public/uploads (our computer) or from Vercel Blob.
  const saved = url.startsWith("/") ? readFileSync(path.join(process.cwd(), "public", url)) : await (await page.request.get(url)).body();
  expect(saved.length).toBeLessThan(FOUR_MB);
  expect([saved[0], saved[1], saved[2]]).toEqual([0xff, 0xd8, 0xff]); // the first bytes of every JPEG

  // The site really shows the new photo (also on a production build, see src/app/uploads/[file]/route.ts).
  const shown = await page.request.get(url);
  expect(shown.status()).toBe(200);
  expect(shown.headers()["content-type"]).toBe("image/jpeg");

  // The upload worked: the preview is shown and no error message appears.
  await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();
  await expect(page.getByText("too big")).toBeHidden();
});

test("the photo address only gives uploaded photos", async ({ request }) => {
  expect((await request.get("/uploads/..%2F.env")).status()).toBe(404);
  expect((await request.get("/uploads/0123456789abcdef0123456789abcdef.jpg")).status()).toBe(404); // no such photo
});

test("a file that is too big and is not a photo gets a clear message", async ({ page }) => {
  const notAPhoto = Buffer.alloc(FOUR_MB + 1024, "x"); // 4 MB of text, named like a photo
  await page.locator('input[type="file"]').setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: notAPhoto });
  await expect(page.getByText("This photo is still too big after making it smaller (4 MB at most)")).toBeVisible();
  await expect(page.getByRole("img", { name: "Photo 1" })).toBeHidden();
});
