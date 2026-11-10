// Unit tests for photo uploads: finding the real picture type from the first bytes, choosing
// where photos are kept (src/lib/services/upload.ts) and the allowed photo address shape
// (validators/upload.ts).
import { describe, expect, it } from "vitest";
import { detectImageType, usesBlobStorage } from "@/lib/services/upload";
import { UPLOADED_IMAGE_URL_REGEX } from "@/lib/validators/upload";

/** Makes a byte list from numbers and text, e.g. bytes("RIFF", 0, 0, 0, 0, "WEBP"). */
function bytes(...parts: (string | number)[]): Uint8Array {
  const values: number[] = [];
  for (const part of parts) {
    if (typeof part === "number") {
      values.push(part);
    } else {
      values.push(...Array.from(part, (letter) => letter.charCodeAt(0)));
    }
  }
  return new Uint8Array(values);
}

describe("detectImageType", () => {
  it("knows a JPG, a PNG and a WebP from their first bytes", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("jpg");
    expect(detectImageType(bytes(0x89, "PNG", 0x0d, 0x0a))).toBe("png");
    expect(detectImageType(bytes("RIFF", 0x24, 0, 0, 0, "WEBPVP8 "))).toBe("webp");
  });

  it("rejects other files, even if they are named .jpg", () => {
    expect(detectImageType(bytes("%PDF-1.7"))).toBeNull(); // a PDF
    expect(detectImageType(bytes("<html>"))).toBeNull(); // a web page
    expect(detectImageType(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBeNull(); // a sound file
  });

  it("rejects files that are too short", () => {
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("UPLOADED_IMAGE_URL_REGEX", () => {
  const blobStore = "https://abc123xyz.public.blob.vercel-storage.com";

  it("accepts addresses made by our upload service", () => {
    expect(UPLOADED_IMAGE_URL_REGEX.test("/uploads/9f86d081884c7d659a2feaa0c55ad015.jpg")).toBe(true);
    expect(UPLOADED_IMAGE_URL_REGEX.test("/uploads/9f86d081884c7d659a2feaa0c55ad015.webp")).toBe(true);
  });

  it("accepts the Vercel Blob address of a photo saved on Vercel", () => {
    expect(UPLOADED_IMAGE_URL_REGEX.test(`${blobStore}/uploads/9f86d081884c7d659a2feaa0c55ad015.jpg`)).toBe(true);
    expect(UPLOADED_IMAGE_URL_REGEX.test(`${blobStore}/uploads/9f86d081884c7d659a2feaa0c55ad015.png`)).toBe(true);
  });

  it("rejects other addresses", () => {
    expect(UPLOADED_IMAGE_URL_REGEX.test("https://evil.com/a.jpg")).toBe(false);
    expect(UPLOADED_IMAGE_URL_REGEX.test("/uploads/../.env")).toBe(false);
    expect(UPLOADED_IMAGE_URL_REGEX.test("/uploads/short.jpg")).toBe(false);
    expect(UPLOADED_IMAGE_URL_REGEX.test("/uploads/9f86d081884c7d659a2feaa0c55ad015.gif")).toBe(false);
  });

  it("rejects look-alike addresses on other websites", () => {
    const photo = "uploads/9f86d081884c7d659a2feaa0c55ad015.jpg";
    expect(UPLOADED_IMAGE_URL_REGEX.test(`https://evil.com/${photo}`)).toBe(false);
    expect(UPLOADED_IMAGE_URL_REGEX.test(`http://abc.public.blob.vercel-storage.com/${photo}`)).toBe(false); // not https
    expect(UPLOADED_IMAGE_URL_REGEX.test(`https://public.blob.vercel-storage.com.evil.com/${photo}`)).toBe(false);
    expect(UPLOADED_IMAGE_URL_REGEX.test(`${blobStore}/other/9f86d081884c7d659a2feaa0c55ad015.jpg`)).toBe(false);
  });
});

describe("usesBlobStorage", () => {
  it("uses Vercel Blob only when its token is set", () => {
    expect(usesBlobStorage({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_example" })).toBe(true);
    expect(usesBlobStorage({})).toBe(false);
    expect(usesBlobStorage({ BLOB_READ_WRITE_TOKEN: "" })).toBe(false);
  });
});
