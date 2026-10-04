// Layout for public pages (home, login, register): navbar on top, footer at the bottom.
// "(public)" in brackets is a route group: it groups pages without adding to the URL.
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
