"use client";
// The round avatar button in the navbar. Opens a small menu with the user's name,
// role, links to dashboard and profile, and the log out button.
import { LayoutDashboard, LogOut, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/auth";
import { Link } from "@/lib/navigation";

type UserMenuProps = {
  name: string;
  roleLabel: string; // already translated, e.g. "Farmer" or "কৃষক"
  dashboardHref: string; // e.g. "/farmer"
};

export function UserMenu({ name, roleLabel, dashboardHref }: UserMenuProps) {
  const t = useTranslations("Common");
  const [isPending, startTransition] = useTransition();
  const firstLetter = name.trim().charAt(0).toUpperCase() || "?";

  /** Calls the logout server action (it redirects to the home page). */
  function logout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full font-semibold" aria-label={name}>
          {firstLetter}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs font-normal text-muted-foreground">{roleLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={dashboardHref}>
            <LayoutDashboard aria-hidden />
            {t("dashboard")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User aria-hidden />
            {t("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} disabled={isPending} variant="destructive">
          <LogOut aria-hidden />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
