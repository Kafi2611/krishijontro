// Auth.js (NextAuth) setup: log in with phone number + password, and keep the
// user's id, role and phone in the session.
// Also has small helpers that pages and server actions use to check who is logged in.
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getLocale } from "next-intl/server";
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

/** Returns the logged-in user, or null if nobody is logged in. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    phone: session.user.phone,
    role: session.user.role,
  };
}

/**
 * Makes sure someone is logged in and returns them.
 * If nobody is logged in, it sends the visitor to the login page instead.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const locale = await getLocale();
    return redirect({ href: "/login", locale });
  }
  return user;
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
