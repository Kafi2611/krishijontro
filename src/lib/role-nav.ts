// The sidebar links for each role. Each phase adds the links of its new pages here.
import type { Role } from "@/generated/prisma/enums";
import { getHomePathForRole } from "@/lib/roles";
import type messages from "../../messages/en.json";

/** Icon names the sidebar knows (see components/layout/nav-icon.tsx). */
export type NavIconName =
  | "dashboard"
  | "bell"
  | "user"
  | "machineTypes"
  | "machines"
  | "operators"
  | "business"
  | "approvals"
  | "pricing"
  | "search"
  | "bookings"
  | "earnings"
  | "payments"
  | "subsidy"
  | "verify"
  | "applications"
  | "breakdowns"
  | "repairs"
  | "waitlist";

/** A key of the "Nav" section in messages/en.json, e.g. "profile". */
export type NavLabelKey = keyof (typeof messages)["Nav"];

export type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  icon: NavIconName;
};

/** Extra links that only one role has. Roles without links yet get them in later phases. */
const ROLE_LINKS: Record<Role, NavItem[]> = {
  FARMER: [
    { href: "/farmer/search", labelKey: "search", icon: "search" },
    { href: "/farmer/bookings", labelKey: "myBookings", icon: "bookings" },
    { href: "/farmer/waitlist", labelKey: "waitlist", icon: "waitlist" },
    { href: "/farmer/subsidy", labelKey: "subsidy", icon: "subsidy" },
  ],
  COOP_LEADER: [],
  PROVIDER: [
    { href: "/provider/bookings", labelKey: "bookings", icon: "bookings" },
    { href: "/provider/earnings", labelKey: "earnings", icon: "earnings" },
    { href: "/provider/machines", labelKey: "machines", icon: "machines" },
    { href: "/provider/operators", labelKey: "operators", icon: "operators" },
    { href: "/provider/business", labelKey: "business", icon: "business" },
  ],
  OPERATOR: [{ href: "/operator/jobs", labelKey: "myJobs", icon: "bookings" }],
  TECHNICIAN: [{ href: "/technician/requests", labelKey: "repairRequests", icon: "repairs" }],
  OFFICER: [
    { href: "/officer/farmers", labelKey: "verifyFarmers", icon: "verify" },
    { href: "/officer/subsidies", labelKey: "subsidyApplications", icon: "applications" },
  ],
  GOVT: [
    { href: "/govt/pricing", labelKey: "pricing", icon: "pricing" },
    { href: "/govt/subsidies", labelKey: "subsidyPrograms", icon: "subsidy" },
  ],
  ADMIN: [
    { href: "/admin/approvals", labelKey: "approvals", icon: "approvals" },
    { href: "/admin/breakdowns", labelKey: "breakdowns", icon: "breakdowns" },
    { href: "/admin/payments", labelKey: "payments", icon: "payments" },
    { href: "/admin/machine-types", labelKey: "machineTypes", icon: "machineTypes" },
  ],
};

/** Links every logged-in user has, shown at the bottom of the sidebar. */
const COMMON_LINKS: NavItem[] = [
  { href: "/notifications", labelKey: "notifications", icon: "bell" },
  { href: "/profile", labelKey: "profile", icon: "user" },
];

/**
 * Returns the full list of sidebar links for a role:
 * the dashboard first, then the role's own links, then the common links.
 */
export function getNavItemsForRole(role: Role): NavItem[] {
  const dashboardLink: NavItem = {
    href: getHomePathForRole(role),
    labelKey: "dashboard",
    icon: "dashboard",
  };
  return [dashboardLink, ...ROLE_LINKS[role], ...COMMON_LINKS];
}
