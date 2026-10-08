// The sidebar links for each role. Each phase adds the links of its new pages here.
import type { Role } from "@/generated/prisma/enums";
import { getHomePathForRole } from "@/lib/roles";
import type messages from "../../messages/en.json";

/** Icon names the sidebar knows (see components/layout/nav-icon.tsx). */
export type NavIconName = "dashboard" | "bell" | "user" | "machineTypes" | "machines";

/** A key of the "Nav" section in messages/en.json, e.g. "profile". */
export type NavLabelKey = keyof (typeof messages)["Nav"];

export type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  icon: NavIconName;
};

/** Extra links that only one role has. Roles without links yet get them in later phases. */
const ROLE_LINKS: Record<Role, NavItem[]> = {
  FARMER: [],
  COOP_LEADER: [],
  PROVIDER: [{ href: "/provider/machines", labelKey: "machines", icon: "machines" }],
  OPERATOR: [],
  TECHNICIAN: [],
  OFFICER: [],
  GOVT: [],
  ADMIN: [{ href: "/admin/machine-types", labelKey: "machineTypes", icon: "machineTypes" }],
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
