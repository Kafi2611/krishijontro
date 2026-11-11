// GET /<locale>/login/clear — removes an old login whose account no longer exists, then opens
// the normal login page. requireUser() in lib/auth.ts sends a visitor here when their login
// cookie points to an account that is not in the database any more (e.g. after `npm run db:seed`).
// This is a route, not a page, because a page cannot remove a cookie (a route can).
import { hasLocale } from "next-intl";
import { clearLoginIfAccountGone } from "@/lib/auth";
import { routing } from "@/lib/i18n";
import { redirect } from "@/lib/navigation";

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // The language comes from the address: use it only if it is one we have ("en" or "bn").
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;

  await clearLoginIfAccountGone();
  // Everyone goes to the login page next. Someone whose account is fine still has their
  // login, so proxy.ts sends them on to their own dashboard (and a suspended user is sent
  // from there to "/login?suspended=1"), so opening this address by mistake does no harm.
  redirect({ href: "/login", locale: safeLocale });
}
