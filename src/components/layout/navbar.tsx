// The top bar shown on every page: logo, language switch, and either
// Login/Register buttons (visitors) or the bell + user menu (logged-in users).
// This is a Server Component: it reads the login cookie and the unread count on the server.
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { getHomePathForRole } from "@/lib/roles";
import { countUnreadNotifications } from "@/lib/services/notification";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import type { SidebarLink } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

type NavbarProps = {
  // Only dashboard pages pass sidebar links: then a menu button appears on phones.
  sidebarLinks?: SidebarLink[];
};

export async function Navbar({ sidebarLinks }: NavbarProps) {
  const t = await getTranslations("Common");
  const tRoles = await getTranslations("Roles");
  const user = await getCurrentUser();
  const unreadCount = user ? await countUnreadNotifications(user.id) : 0;
  const hasSidebar = sidebarLinks !== undefined;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-1 px-3 sm:gap-2 sm:px-4">
        {hasSidebar && user && (
          <MobileNav items={sidebarLinks} areaLabel={tRoles(user.role)} />
        )}
        <Logo hideNameOnPhone={hasSidebar} />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          {user ? (
            <>
              <NotificationBell unreadCount={unreadCount} />
              <UserMenu
                name={user.name}
                roleLabel={tRoles(user.role)}
                dashboardHref={getHomePathForRole(user.role)}
              />
            </>
          ) : (
            <>
              <Button asChild>
                <Link href="/login">{t("login")}</Link>
              </Button>
              {/* On small phones there is no room; the home page has its own register button */}
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href="/register">{t("register")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
