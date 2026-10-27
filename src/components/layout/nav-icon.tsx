// Turns an icon NAME (like "bell") into the real lucide-react icon.
// We pass names instead of icon components because the sidebar list is made on
// the server and sent to the browser, and only plain data can be sent that way.
import {
  BadgeCheck,
  BadgePercent,
  Banknote,
  Bell,
  CalendarCheck,
  FileCheck,
  Hourglass,
  LayoutDashboard,
  Scale,
  Search,
  Shapes,
  Store,
  Tractor,
  TriangleAlert,
  User,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/role-nav";

const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  bell: Bell,
  user: User,
  machineTypes: Shapes,
  machines: Tractor,
  operators: Users,
  business: Store,
  approvals: BadgeCheck,
  pricing: Scale,
  search: Search,
  bookings: CalendarCheck,
  earnings: Wallet,
  payments: Banknote,
  subsidy: BadgePercent,
  verify: UserCheck,
  applications: FileCheck,
  breakdowns: TriangleAlert,
  repairs: Wrench,
  waitlist: Hourglass,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = NAV_ICONS[name];
  return <Icon className={className} aria-hidden />;
}
