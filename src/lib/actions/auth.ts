"use server";
// Server actions for logging in, registering and logging out.
// "use server" means these functions always run on the server, even when a
// button in the browser calls them.
import { AuthError, CredentialsSignin } from "next-auth";
import { getLocale } from "next-intl/server";
import { signIn, signOut } from "@/lib/auth";
import { registerUser } from "@/lib/services/user";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@/lib/validators/auth";

/** Sent back to the form when something is wrong. `error` is a key from "Validation". */
export type AuthActionError = { error: string };

/**
 * Only allows redirects to pages of our own site (paths like "/en/farmer").
 * This stops a bad link like ?callbackUrl=https://evil.com from sending users away.
 */
function getSafeRedirectPath(callbackUrl: string | undefined, fallback: string): string {
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }
  return fallback;
}

/**
 * Logs the user in with phone + password.
 * On success the user is redirected (to callbackUrl or their dashboard), so nothing
 * is returned. On failure it returns { error: "invalidCredentials" } or similar.
 */
export async function loginAction(
  values: LoginInput,
  callbackUrl?: string,
): Promise<AuthActionError | undefined> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "invalidCredentials" };
  }

  const locale = await getLocale();
  try {
    await signIn("credentials", {
      phone: parsed.data.phone,
      password: parsed.data.password,
      redirectTo: getSafeRedirectPath(callbackUrl, `/${locale}/dashboard`),
    });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "suspended") {
      return { error: "accountSuspended" };
    }
    if (error instanceof AuthError) {
      return { error: "invalidCredentials" };
    }
    // A successful login "throws" a redirect. We must re-throw it so Next.js can redirect.
    throw error;
  }
}

/**
 * Creates a FARMER or PROVIDER account, then logs the new user in straight away.
 * Returns { error: "phoneTaken" } if that phone number already has an account.
 */
export async function registerAction(values: RegisterInput): Promise<AuthActionError | undefined> {
  // Check the form again on the server: never trust data coming from the browser.
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "somethingWrong" };
  }

  const result = await registerUser(parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  const locale = await getLocale();
  await signIn("credentials", {
    phone: parsed.data.phone,
    password: parsed.data.password,
    redirectTo: `/${locale}/dashboard`,
  });
}

/** Logs the user out and sends them to the home page. */
export async function logoutAction(): Promise<void> {
  const locale = await getLocale();
  await signOut({ redirectTo: `/${locale}` });
}
