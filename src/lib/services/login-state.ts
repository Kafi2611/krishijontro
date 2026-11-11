/**
 * Login state — what an old login is still worth.
 *
 * The login cookie is made once, at login. After that the account itself can change:
 *   - an admin may SUSPEND it: the user is stopped and the login page tells them why
 *   - it may NOT EXIST any more: for example `npm run db:seed` deletes every account and
 *     makes new ones, so the cookie points to nobody. That visitor is simply logged out:
 *     the old cookie is removed and the normal login page opens. They do NOT see the
 *     "suspended" message, because nobody suspended them.
 *
 * Pure functions (no database), so they are easy to test. lib/auth.ts reads the account
 * from the database and uses them.
 */
import type { UserStatus } from "@/generated/prisma/enums";

/**
 * ACTIVE       = the user may go on
 * SUSPENDED    = an admin stopped this account
 * ACCOUNT_GONE = the login cookie points to an account that is not in the database
 */
export type LoginState = "ACTIVE" | "SUSPENDED" | "ACCOUNT_GONE";

/** The route that removes a login whose account is gone: src/app/[locale]/(public)/login/clear/route.ts */
export const CLEAR_LOGIN_PATH = "/login/clear";

/**
 * Decides the state of a login from its account, as read from the database.
 * Takes the account (or null when no account has the id in the cookie).
 * Example: getLoginState({ status: "SUSPENDED" }) -> "SUSPENDED", getLoginState(null) -> "ACCOUNT_GONE"
 */
export function getLoginState(account: { status: UserStatus } | null): LoginState {
  if (account === null) {
    return "ACCOUNT_GONE";
  }
  if (account.status === "ACTIVE") {
    return "ACTIVE";
  }
  return "SUSPENDED";
}

/**
 * Where requireUser() sends a visitor who may not go on.
 * Takes the login state, or null when nobody is logged in. Returns a path without the language.
 *   null           -> "/login"             the normal login page
 *   "SUSPENDED"    -> "/login?suspended=1" the login page, which then says the account is suspended
 *   "ACCOUNT_GONE" -> "/login/clear"       removes the old login, then opens the normal login page
 * (A page cannot remove a cookie, only a route or a server action can. That is why the
 * ACCOUNT_GONE visitor goes through a route first.)
 */
export function getLoginPagePath(state: LoginState | null): string {
  if (state === "SUSPENDED") {
    return "/login?suspended=1";
  }
  if (state === "ACCOUNT_GONE") {
    return CLEAR_LOGIN_PATH;
  }
  return "/login";
}
