// The "Page not found" (404) page, shown in the current language.
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/navigation";

export default async function NotFoundPage() {
  const t = await getTranslations("Common");
  return (
    <>
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <SearchX className="size-14 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
        <p className="text-muted-foreground">{t("notFoundText")}</p>
        <Button asChild size="lg">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </main>
      <Footer />
    </>
  );
}
