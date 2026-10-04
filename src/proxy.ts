// proxy.ts runs BEFORE every page request (older Next.js versions called this "middleware").
// It does two jobs:
//   1. Guards each role's pages: /farmer/... only for FARMER, /admin/... only for ADMIN, etc.
//      Visitors who are not logged in are sent to the login page.
//   2. Makes sure every URL starts with a language (/en or /bn), using next-intl.
// Pages and server actions ALSO check the role (requireRole in lib/auth.ts), so even if
// this file had a bug, nobody could see another role's data.
import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { routing } from "@/lib/i18n";
import {
  getHomePathForRole,
  getRoleForPath,
  isAccountPath,
  splitLocaleFromPath,
} from "@/lib/roles";

// Only the light auth settings (no database) — enough to read the login cookie.
const { auth } = NextAuth(authConfig);
const handleLanguage = createIntlMiddleware(routing);

export default auth(function proxy(request) {
  const { locale, path } = splitLocaleFromPath(request.nextUrl.pathname);
  const user = request.auth?.user;
  const roleNeeded = getRoleForPath(path); // e.g. "FARMER" for /farmer/..., null for public pages

  // 1. Not logged in, but the page needs a login -> go to the login page,
  //    and remember where they wanted to go (callbackUrl).
  if (!user && (roleNeeded !== null || isAccountPath(path))) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    const ownHome = `/${locale}${getHomePathForRole(user.role)}`;

    // 2. Logged in, but this page belongs to another role -> go to their own dashboard.
    if (roleNeeded !== null && roleNeeded !== user.role) {
      return NextResponse.redirect(new URL(ownHome, request.url));
    }

    // 3. Already logged in -> the login and register pages are not needed.
    if (path === "/login" || path === "/register") {
      return NextResponse.redirect(new URL(ownHome, request.url));
    }
  }

  // 4. Everything is fine: let next-intl handle the language part of the URL.
  return handleLanguage(request);
});

export const config = {
  // Run on every page, but skip API routes, Next.js internal files and files
  // with a dot in the name (images, favicon.ico, ...).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
