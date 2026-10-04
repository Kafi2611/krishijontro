// proxy.ts runs BEFORE every page request (older Next.js versions called this "middleware").
// For now it has one job: make sure every URL starts with a language (/en or /bn),
// using next-intl. Example: "/" becomes "/en" (or "/bn" if the browser prefers Bangla).
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n";

export default createIntlMiddleware(routing);

export const config = {
  // Run on every page, but skip API routes, Next.js internal files and files
  // with a dot in the name (images, favicon.ico, ...).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
