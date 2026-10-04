// Role settings shared by the whole app:
// - which URL folder belongs to which role (e.g. /farmer -> FARMER)
// - each role's home (dashboard) page
// Used by proxy.ts (route protection), the sidebar and the login redirect.
import type { Role } from "@/generated/prisma/enums";
import { routing } from "@/lib/i18n";

/** The URL folder of each role's pages. A FARMER's pages are all under /farmer. */
export const ROLE_HOME_PATH: Record<Role, string> = {
  FARMER: "/farmer",
  COOP_LEADER: "/cooperative",
  PROVIDER: "/provider",
  OPERATOR: "/operator",
  TECHNICIAN: "/technician",
  OFFICER: "/officer",
  GOVT: "/govt",
  ADMIN: "/admin",
};

/** All roles, in the order we show them. */
export const ALL_ROLES = Object.keys(ROLE_HOME_PATH) as Role[];

/** Only these roles may create their own account. Staff accounts are made by admin. */
export const SELF_REGISTER_ROLES = ["FARMER", "PROVIDER"] as const;

/** Pages every logged-in user can open, whatever their role. */
export const ACCOUNT_PATHS = ["/dashboard", "/profile", "/notifications"];

/**
 * Returns the dashboard path for a role.
 * Example: getHomePathForRole("PROVIDER") -> "/provider"
 */
export function getHomePathForRole(role: Role): string {
  return ROLE_HOME_PATH[role];
}

/**
 * Finds which role owns a page, from the first folder of the path.
 * Example: "/farmer/bookings" -> "FARMER", "/login" -> null (public page)
 */
export function getRoleForPath(path: string): Role | null {
  const firstFolder = "/" + (path.split("/")[1] ?? "");
  for (const role of ALL_ROLES) {
    if (ROLE_HOME_PATH[role] === firstFolder) {
      return role;
    }
  }
  return null;
}

/**
 * True if the path is a page for any logged-in user (profile, messages...).
 * Example: "/profile" -> true, "/farmer" -> false
 */
export function isAccountPath(path: string): boolean {
  return ACCOUNT_PATHS.some(
    (accountPath) => path === accountPath || path.startsWith(accountPath + "/"),
  );
}

/**
 * Splits the language out of a URL path.
 * Example: "/bn/farmer/bookings" -> { locale: "bn", path: "/farmer/bookings" }
 * If the path has no language, we use the default language.
 */
export function splitLocaleFromPath(pathname: string): { locale: string; path: string } {
  const firstFolder = pathname.split("/")[1] ?? "";
  const hasLocale = (routing.locales as readonly string[]).includes(firstFolder);

  if (!hasLocale) {
    return { locale: routing.defaultLocale, path: pathname };
  }

  const pathWithoutLocale = pathname.slice(firstFolder.length + 1);
  return { locale: firstFolder, path: pathWithoutLocale === "" ? "/" : pathWithoutLocale };
}
