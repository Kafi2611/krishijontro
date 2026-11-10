// GET /uploads/<name>.jpg — sends a photo saved in the public/uploads folder.
// Why this route is needed: when the site runs as a production build on our own computer
// (`npm start`), Next.js only serves the files that were in public/ when the site was BUILT.
// A photo uploaded later would show as a broken picture. Next.js first looks for a real file in
// public/ and only comes here when it does not find one, so this route reads the file itself.
// (`npm run dev` serves new files by itself, and on Vercel the photos live in Vercel Blob.)
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Only names made by our upload service: 32 random hex letters + the picture type. */
const UPLOADED_FILE_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

/** The type name browsers need for each picture type. */
const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // Checking the name first also stops tricks like "../.env": only one plain file name passes.
  const match = UPLOADED_FILE_NAME.exec(file);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "uploads", file));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[match[1]],
        // The name is random and a photo never changes, so the browser may keep it for a year.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 }); // no such photo
  }
}
