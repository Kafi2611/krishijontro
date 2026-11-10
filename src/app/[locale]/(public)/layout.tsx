// Layout for public pages (home, login, register): navbar on top, footer at the bottom.
// "(public)" in brackets is a route group: it groups pages without adding to the URL.
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { MAIN_CONTENT_ID } from "@/components/layout/skip-link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer />
    </>
  );
}
