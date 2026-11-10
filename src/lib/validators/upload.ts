// Rules for uploaded photos, shared by the browser (photo picker) and the server.
import { z } from "zod";

/**
 * Largest photo we accept: 4 MB. Vercel refuses any request bigger than 4.5 MB before it even
 * reaches our code, so a bigger limit would only work on our own computer.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** A machine can have at most this many photos. */
export const MAX_MACHINE_PHOTOS = 5;

/** Tells the phone's file picker to show only these picture types. */
export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

/**
 * What a saved photo's address looks like. There are two kinds (see lib/services/upload.ts):
 *   - on our own computer:  /uploads/9f86d081884c7d659a2feaa0c55ad015.jpg
 *   - on Vercel (Blob):     https://<store id>.public.blob.vercel-storage.com/uploads/9f86....jpg
 * Both end with "uploads/" + a random 32-letter name + the picture type.
 * Forms send these addresses to the server; checking the shape stops anyone from
 * saving some other address (e.g. a picture from another website) as a machine photo.
 */
export const UPLOADED_IMAGE_URL_REGEX =
  /^(\/|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/)uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/;

export const uploadedImageUrlSchema = z.string().regex(UPLOADED_IMAGE_URL_REGEX, "somethingWrong");
