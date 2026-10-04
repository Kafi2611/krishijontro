// The login page (/en/login). Shows the login form, and in development mode
// also a list of demo accounts to log in quickly.
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { Link } from "@/lib/navigation";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams;
  const t = await getTranslations("Auth");
  const tRoles = await getTranslations("Roles");

  // Demo accounts are a testing shortcut: never show them on the real (production) site.
  const isDevelopment = process.env.NODE_ENV === "development";
  const demoAccounts = isDevelopment
    ? DEMO_ACCOUNTS.map((account) => ({
        phone: account.phone,
        name: account.name,
        roleLabel: tRoles(account.role),
      }))
    : undefined;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("loginTitle")}</CardTitle>
          <CardDescription>{t("loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl} demoAccounts={demoAccounts} />
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-sm">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </div>
  );
}
