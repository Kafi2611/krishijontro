// Makes a photo smaller IN THE BROWSER before it is uploaded.
// A phone photo is often 3–6 MB and 4000 × 3000 pixels, but the server accepts at most 4 MB
// (MAX_IMAGE_BYTES), and a machine photo looks just as good at 1600 pixels. So before uploading
// we draw the photo smaller on a <canvas> and save it as a JPEG; this usually gives 200–600 KB.
// The server still checks the real type and the size of every file (lib/services/upload.ts).
import { MAX_IMAGE_BYTES } from "@/lib/validators/upload";

/** The longest side (width or height) of a photo after shrinking, in pixels. */
export const MAX_PHOTO_SIDE = 1600;

/** Photos at most this big (and not too wide or tall) are sent as they are: 1 MB. */
const SMALL_ENOUGH_BYTES = 1024 * 1024;

/** The JPEG qualities we try, best first, until the photo fits under MAX_IMAGE_BYTES. */
export const JPEG_QUALITIES = [0.82, 0.72, 0.6];

/**
 * The new width and height for a photo, so that its longest side is at most `maxSide`.
 * The shape (aspect ratio) stays the same, and a small photo is never made bigger.
 * Example: getResizedSize(4000, 3000, 1600) -> { width: 1600, height: 1200 }
 *          getResizedSize(800, 600, 1600)   -> { width: 800, height: 600 }
 */
export function getResizedSize(width: number, height: number, maxSide: number = MAX_PHOTO_SIDE) {
  const longestSide = Math.max(width, height);
  if (longestSide <= maxSide) {
    return { width, height };
  }
  const scale = maxSide / longestSide;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** "machine.png" -> "machine.jpg" (the shrunk photo is always a JPEG). */
function jpegFileName(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return `${withoutExtension || "photo"}.jpg`;
}

/** Saves what is drawn on the canvas as a JPEG of the given quality (0–1). */
function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Makes one photo smaller for uploading (see the top of this file).
 * Returns a new, smaller JPEG file, or the same file when it is already small enough.
 * It never throws: if the browser cannot read the photo, the original file is returned, and the
 * size check before uploading (or the server) says what is wrong with it.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  try {
    // createImageBitmap reads the photo; "from-image" turns it the right way up (phones save
    // the rotation separately inside the file).
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = getResizedSize(bitmap.width, bitmap.height);
    const alreadySmall = file.size <= SMALL_ENOUGH_BYTES && size.width === bitmap.width && size.height === bitmap.height;
    if (alreadySmall) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    // JPEG has no see-through parts: a see-through PNG would turn black, so we paint white first.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();

    // Try good quality first; lower it only if the photo is still too big.
    for (const quality of JPEG_QUALITIES) {
      const blob = await canvasToJpeg(canvas, quality);
      if (blob && blob.size <= MAX_IMAGE_BYTES) {
        // Keep the original if shrinking did not make it smaller (and it was allowed already).
        if (blob.size >= file.size && file.size <= MAX_IMAGE_BYTES) {
          return file;
        }
        return new File([blob], jpegFileName(file.name), { type: "image/jpeg" });
      }
    }
    return file; // still too big: the caller shows "too big"
  } catch {
    return file; // the browser could not read this file as a picture
  }
}
