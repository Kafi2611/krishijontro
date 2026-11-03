// Auth.js (NextAuth) setup: log in with phone number + password, and keep the
// user's id, role and phone in the session.
// Also has small helpers that pages and server actions use to check who is logged in.
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { redirect } from "@/lib/navigation";
import { verifyPassword } from "@/lib/password";
import { getHomePathForRole } from "@/lib/roles";
import { loginSchema } from "@/lib/validators/auth";

/** Thrown when the password is right but an admin has suspended the account. */
class AccountSuspendedError extends CredentialsSignin {
  code = "suspended";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    /** Prints real server errors, but not a wrong password (that is normal, not a bug). */
    error(error) {
      if (error instanceof CredentialsSignin) {
        return;
      }
      console.error(error);
    },
  },
  providers: [
    Credentials({
      credentials: {
        phone: {},
        password: {},
      },
      /**
       * Checks the phone + password typed on the login page.
       * Returns the user (login OK) or null (wrong phone or password).
       */
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await db.user.findUnique({ where: { phone: parsed.data.phone } });
        if (!user) {
          return null;
        }

        const passwordIsCorrect = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!passwordIsCorrect) {
          return null;
        }

        if (user.status === "SUSPENDED") {
          throw new AccountSuspendedError();
        }

        return { id: user.id, name: user.name, phone: user.phone, role: user.role };
      },
    }),
  ],
});

/** The logged-in user as our pages see it. */
export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: Role;
};

/**
 * Who the login cookie says is logged in, and whether that account may still be used.
 * The cookie was made at login, and the admin may have suspended the account since then,
 * so we also read the account's status from the database. That way a suspended user is
 * stopped at once, not only at their next login.
 * React's cache() runs this only once per page request, even when the layout, the page and
 * the navbar all ask who is logged in.
 */
const readLogin = cache(async (): Promise<{ user: SessionUser; isSuspended: boolean } | null> => {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const account = await db.user.findUnique({ where: { id: session.user.id }, select: { status: true } });
  return {
    user: {
      id: session.user.id,
      name: session.user.name ?? "",
      phone: session.user.phone,
      role: session.user.role,
    },
    isSuspended: account?.status !== "ACTIVE", // also true if the account no longer exists
  };
});

/** Returns the logged-in user, or null if nobody is logged in (or their account is suspended). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const login = await readLogin();
  if (!login || login.isSuspended) {
    return null;
  }
  return login.user;
}

/**
 * Makes sure someone is logged in and returns them.
 * If nobody is logged in, it sends the visitor to the login page instead.
 * A suspended user goes to the login page too, which then says the account is suspended.
 */
export async function requireUser(): Promise<SessionUser> {
  const login = await readLogin();
  if (!login || login.isSuspended) {
    const locale = await getLocale();
    const href = login ? "/login?suspended=1" : "/login";
    return redirect({ href, locale });
  }
  return login.user;
}

/**
 * Makes sure the logged-in user has one of the allowed roles and returns them.
 * Use it at the top of every role layout and every server action.
 * A user with another role is sent to their own dashboard.
 * Example: const farmer = await requireRole("FARMER");
 */
export async function requireRole(...allowedRoles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) {
    const locale = await getLocale();
    return redirect({ href: getHomePathForRole(user.role), locale });
  }
  return user;
}
