/**
 * Upload service — saves photos people upload (machine photos now, breakdown photos later).
 *
 * In development the files go into the public/uploads folder, so Next.js shows them
 * at the address /uploads/<file name>. (A hosting service like Vercel cannot save
 * files on its disk; the deploy guide in Phase 8 explains using cloud storage there.)
 *
 * Safety rules:
 * - Only JPG, PNG and WebP pictures, at most 5 MB.
 * - We read the first bytes of the file (its "magic number") to learn its REAL type,
 *   because the file name and the type sent by the browser are easy to fake.
 * - We give every file a new random name, so nobody can overwrite another file.
 */
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_IMAGE_BYTES } from "@/lib/validators/upload";

export type ImageExtension = "jpg" | "png" | "webp";

export type SaveImageResult =
  | { ok: true; url: string }
  | { ok: false; error: "imageTooBig" | "imageWrongType" };

/**
 * True if `bytes` contains exactly `expected` starting at position `offset`.
 * Example: hasBytesAt([0xff, 0xd8, 0xff, 0xe0], 0, [0xff, 0xd8]) -> true
 */
function hasBytesAt(bytes: Uint8Array, offset: number, expected: number[]): boolean {
  if (bytes.length < offset + expected.length) {
    return false;
  }
  return expected.every((value, index) => bytes[offset + index] === value);
}

/**
 * Finds the real picture type from the first bytes of a file.
 * Returns "jpg", "png", "webp", or null if it is not one of these.
 */
export function detectImageType(bytes: Uint8Array): ImageExtension | null {
  // Every JPG file starts with the bytes FF D8 FF.
  if (hasBytesAt(bytes, 0, [0xff, 0xd8, 0xff])) {
    return "jpg";
  }
  // Every PNG file starts with 89 50 4E 47 (the letters "PNG" after one special byte).
  if (hasBytesAt(bytes, 0, [0x89, 0x50, 0x4e, 0x47])) {
    return "png";
  }
  // A WebP file starts with "RIFF", then 4 bytes of size, then "WEBP".
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (hasBytesAt(bytes, 0, riff) && hasBytesAt(bytes, 8, webp)) {
    return "webp";
  }
  return null;
}

/**
 * Checks one uploaded photo and saves it in public/uploads with a random name.
 * Returns { ok: true, url: "/uploads/<name>.jpg" } or an error key.
 */
export async function saveUploadedImage(file: File): Promise<SaveImageResult> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "imageTooBig" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = detectImageType(bytes);
  if (!extension) {
    return { ok: false, error: "imageWrongType" };
  }

  // 16 random bytes written as 32 hex letters, e.g. "9f86d081884c7d659a2feaa0c55ad015"
  const fileName = `${randomBytes(16).toString("hex")}.${extension}`;
  const folder = path.join(process.cwd(), "public", "uploads");
  await mkdir(folder, { recursive: true }); // create the folder the first time
  await writeFile(path.join(folder, fileName), bytes);

  return { ok: true, url: `/uploads/${fileName}` };
}
