// Rules for uploaded photos, shared by the browser (photo picker) and the server.
import { z } from "zod";

/** Largest photo we accept: 5 MB. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** A machine can have at most this many photos. */
export const MAX_MACHINE_PHOTOS = 5;

/** Tells the phone's file picker to show only these picture types. */
export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

/**
 * What a saved photo's address looks like: "/uploads/" + a random 32-letter name + type.
 * Example: /uploads/9f86d081884c7d659a2feaa0c55ad015.jpg
 * Forms send these addresses to the server; checking the shape stops anyone from
 * saving some other address (e.g. a picture from another website) as a machine photo.
 */
export const UPLOADED_IMAGE_URL_REGEX = /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/;

export const uploadedImageUrlSchema = z.string().regex(UPLOADED_IMAGE_URL_REGEX, "somethingWrong");
