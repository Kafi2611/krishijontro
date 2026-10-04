// The frame around every dashboard page: navbar on top, role sidebar on the left
// (on phones the sidebar opens from the menu button instead), page content on the right.
import { getTranslations } from "next-intl/server";
import type { Role } from "@/generated/prisma/enums";
import { getNavItemsForRole } from "@/lib/role-nav";
import { Navbar } from "./navbar";
import { SidebarNav, type SidebarLink } from "./sidebar-nav";

type DashboardShellProps = {
  role: Role;
  children: React.ReactNode;
};

export async function DashboardShell({ role, children }: DashboardShellProps) {
  const tNav = await getTranslations("Nav");
  const tRoles = await getTranslations("Roles");

  // Translate the link labels here on the server, then send plain data to the browser.
  const sidebarLinks: SidebarLink[] = getNavItemsForRole(role).map((item) => ({
    href: item.href,
    icon: item.icon,
    label: tNav(item.labelKey),
  }));

  return (
    <>
      <Navbar sidebarLinks={sidebarLinks} />
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside className="hidden w-60 shrink-0 border-r p-3 md:block">
          <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {tRoles(role)}
          </p>
          <SidebarNav items={sidebarLinks} />
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </>
  );
}
