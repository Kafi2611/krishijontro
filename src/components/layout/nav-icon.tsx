// Turns an icon NAME (like "bell") into the real lucide-react icon.
// We pass names instead of icon components because the sidebar list is made on
// the server and sent to the browser, and only plain data can be sent that way.
import { Bell, LayoutDashboard, User, type LucideIcon } from "lucide-react";
import type { NavIconName } from "@/lib/role-nav";

const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  bell: Bell,
  user: User,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = NAV_ICONS[name];
  return <Icon className={className} aria-hidden />;
}
