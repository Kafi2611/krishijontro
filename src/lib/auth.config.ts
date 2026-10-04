// The "light" part of the Auth.js settings.
// proxy.ts runs before every request and must stay small and fast, so it only
// imports THIS file (no database, no bcrypt). The full setup is in lib/auth.ts.
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  // Keep the login in a signed cookie (a JWT) instead of a database table.
  session: { strategy: "jwt" },
  // Needed when the app runs somewhere other than Vercel (e.g. `npm start` on our PC).
  trustHost: true,
  pages: { signIn: "/login" },
  // The real phone + password provider is added in lib/auth.ts.
  providers: [],
  callbacks: {
    /**
     * Runs when the login cookie is made (right after login) and each time it is read.
     * On login, `user` is what authorize() returned: we copy id, role and phone into the cookie.
     */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.phone = user.phone;
      }
      return token;
    },
    /**
     * Runs when the app asks "who is logged in?" (the auth() function).
     * We copy id, role and phone from the cookie into session.user.
     */
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.phone = token.phone;
      return session;
    },
  },
} satisfies NextAuthConfig;
