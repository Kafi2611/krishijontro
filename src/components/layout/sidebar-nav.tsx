"use client";
// The list of links in the role sidebar (also used inside the mobile menu).
// It is a Client Component because it needs the current URL to highlight the open page.
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/lib/navigation";
import type { NavIconName } from "@/lib/role-nav";
import { NavIcon } from "./nav-icon";

/** A sidebar link whose label is already translated. */
export type SidebarLink = {
  href: string;
  label: string;
  icon: NavIconName;
};

type SidebarNavProps = {
  items: SidebarLink[];
  onNavigate?: () => void; // the mobile menu uses this to close itself after a click
};

export function SidebarNav({ items, onNavigate }: SidebarNavProps) {
  const pathname = usePathname(); // e.g. "/farmer" (without /en or /bn)

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        // The first link is the dashboard (e.g. "/farmer"): only exact match counts,
        // otherwise it would light up on every farmer page.
        const isDashboard = item.icon === "dashboard";
        const isActive = isDashboard
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-base font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <NavIcon name={item.icon} className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
