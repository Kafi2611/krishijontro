/**
 * Upload service — saves the photos people upload (machine photos, breakdown photos).
 *
 * Where a photo is kept depends on where the app runs:
 *   - On our own computer: in the public/uploads folder, so Next.js shows it at the address
 *     /uploads/<file name>.
 *   - On Vercel: a Vercel server cannot keep files on its disk (the disk is read-only and is
 *     thrown away after each request), so the photo goes to Vercel Blob, a file store in the
 *     cloud, and gets an address like
 *     https://<store id>.public.blob.vercel-storage.com/uploads/<file name>.
 * We use Vercel Blob whenever BLOB_READ_WRITE_TOKEN is set (Vercel adds it when a Blob store
 * is connected to the project), otherwise the local folder.
 *
 * Safety rules:
 * - Only JPG, PNG and WebP pictures, at most 4 MB.
 * - We read the first bytes of the file (its "magic number") to learn its REAL type,
 *   because the file name and the type sent by the browser are easy to fake.
 * - We give every file a new random name, so nobody can overwrite another file.
 */
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { MAX_IMAGE_BYTES } from "@/lib/validators/upload";

export type ImageExtension = "jpg" | "png" | "webp";

export type SaveImageResult =
  | { ok: true; url: string }
  | { ok: false; error: "imageTooBig" | "imageWrongType" | "uploadFailed" };

/** The type name browsers use for each picture type (sent along when the photo is shown). */
const CONTENT_TYPES: Record<ImageExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

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
 * True if photos go to Vercel Blob (its token is set), false if they go to the local folder.
 * Example: usesBlobStorage({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_..." }) -> true
 */
export function usesBlobStorage(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Saves a photo in Vercel Blob and returns its public address.
 * put() reads the token from BLOB_READ_WRITE_TOKEN by itself.
 */
async function saveToBlobStore(fileName: string, bytes: Uint8Array, extension: ImageExtension): Promise<string> {
  const blob = await put(`uploads/${fileName}`, Buffer.from(bytes), {
    access: "public", // machine photos are shown to everyone, like the files in public/uploads
    contentType: CONTENT_TYPES[extension],
  });
  return blob.url;
}

/** Saves a photo in the public/uploads folder and returns its address on our own site. */
async function saveToLocalFolder(fileName: string, bytes: Uint8Array): Promise<string> {
  const folder = path.join(process.cwd(), "public", "uploads");
  await mkdir(folder, { recursive: true }); // create the folder the first time
  await writeFile(path.join(folder, fileName), bytes);
  return `/uploads/${fileName}`;
}

/**
 * Checks one uploaded photo and saves it with a random name (in Vercel Blob or in
 * public/uploads, see the top of this file).
 * Returns { ok: true, url } with the photo's address, or an error key.
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
  try {
    const url = usesBlobStorage()
      ? await saveToBlobStore(fileName, bytes, extension)
      : await saveToLocalFolder(fileName, bytes);
    return { ok: true, url };
  } catch (error) {
    // The file store could not be reached, or (on Vercel without a Blob store) the disk is read-only.
    console.error("Saving an uploaded photo failed", error);
    return { ok: false, error: "uploadFailed" };
  }
}
