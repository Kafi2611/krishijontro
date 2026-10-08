// API route for uploading ONE photo:  POST /api/upload  (form field "file").
// The photo picker calls it as soon as a photo is chosen, so the person sees a
// preview before saving the form. The form then sends only the photo's address.
// Answers with { url: "/uploads/<name>.jpg" } or { error: "<message key>" }.
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";
import { saveUploadedImage } from "@/lib/services/upload";
import { MAX_IMAGE_BYTES } from "@/lib/validators/upload";

// Only these roles upload photos: providers (machine photos), operators (breakdown photos, Phase 6).
const UPLOAD_ROLES: Role[] = ["PROVIDER", "OPERATOR"];

// The whole request may be a little bigger than the photo (form field names, boundaries).
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 100 * 1024;

export async function POST(request: Request) {
  // 1. Who is asking? Only logged-in providers and operators may upload.
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !UPLOAD_ROLES.includes(role)) {
    return Response.json({ error: "notAllowed" }, { status: 403 });
  }

  // 2. Refuse a huge upload early, before reading it into memory.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "imageTooBig" }, { status: 413 });
  }

  // 3. Read the photo from the form data.
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "imageWrongType" }, { status: 400 });
  }

  // 4. Check its real type and size, then save it.
  const result = await saveUploadedImage(file);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ url: result.url });
}
