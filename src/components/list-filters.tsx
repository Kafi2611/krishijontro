// Shared parts for long lists whose filters live in the page address (lib/list-params.ts):
//   FilterLinks — a row of buttons that filter the list (each is a link to the filtered address)
//   SearchBox   — a search box; "Search" puts the words in the address as ?q=...
//   PageLinks   — "Previous" and "Next" links with "Page 2 of 5" between them
// Used by the admin's Users, Bookings and Audit log pages.
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Form from "next/form";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPathname, Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** One filter button. */
export type FilterLink = {
  href: string;
  label: string;
  active: boolean;
};

/** A row of filter buttons; the active one is green. They wrap onto more lines on a phone. */
export function FilterLinks({ links, label }: { links: FilterLink[]; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.active ? "page" : undefined}
          className={cn(
            "flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
            link.active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

type SearchBoxProps = {
  path: string; // the list page, e.g. "/admin/users"
  query: string; // the words searched now (shown in the box)
  placeholder: string;
  keep?: Record<string, string | null>; // other filters to keep, e.g. { role: "FARMER" }
};

/**
 * A search box. Next.js's <Form> sends the words to the list page as ?q=... without
 * reloading the whole page. Hidden boxes keep the other filters (e.g. the chosen role).
 */
export async function SearchBox({ path, query, placeholder, keep = {} }: SearchBoxProps) {
  const t = await getTranslations("Lists");
  const locale = await getLocale();

  return (
    <Form action={getPathname({ href: path, locale })} className="flex gap-2" role="search">
      {Object.entries(keep).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <Input name="q" defaultValue={query} placeholder={placeholder} aria-label={placeholder} className="h-11" />
      <Button type="submit" size="lg">
        <Search aria-hidden />
        <span className="sr-only sm:not-sr-only">{t("search")}</span>
      </Button>
    </Form>
  );
}

type PageLinksProps = {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string; // the address of another page of the same list
};

/** "Previous / Page 2 of 5 / Next". Shows nothing when everything fits on one page. */
export async function PageLinks({ page, pageCount, hrefFor }: PageLinksProps) {
  if (pageCount <= 1) {
    return null;
  }
  const t = await getTranslations("Lists");

  return (
    <nav aria-label={t("pages")} className="flex items-center justify-between gap-2">
      {page > 1 ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(page - 1)}>
            <ChevronLeft aria-hidden />
            {t("previous")}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground">{t("pageOf", { page, pageCount })}</p>
      {page < pageCount ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(page + 1)}>
            {t("next")}
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
