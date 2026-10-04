// The root layout: the <html> and <body> around EVERY page.
// It loads the fonts, sets the page language, and gives all components access
// to the translated words (NextIntlClientProvider) and pop-up toasts (Toaster).
import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/lib/i18n";
import "../globals.css";

// Inter for English letters, Noto Sans Bengali for Bangla letters.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-bengali" });

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Tells Next.js which languages exist, so /en and /bn pages can be pre-built. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** The browser tab title and description, in the page language. */
export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: safeLocale, namespace: "Common" });
  return {
    title: { default: t("appName"), template: `%s | ${t("appName")}` },
    description: t("tagline"),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Unknown language in the URL (e.g. /fr) -> show "page not found".
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${inter.variable} ${bengali.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          {children}
          <Toaster richColors position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
