// Admin page: every account (/admin/users?role=FARMER&q=karim&page=2).
// Filter buttons for each role (with how many accounts it has), a search by name or mobile
// number, and one card per account with its status and a Suspend / Activate button.
// "Add a staff account" opens the form for the roles that cannot sign up themselves.
import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { UserStatusButton } from "@/components/admin/user-status-button";
import { FilterLinks, PageLinks, SearchBox, type FilterLink } from "@/components/list-filters";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Role } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth";
import { getFormatter } from "@/lib/format-server";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { listHref, readChoice, readPageNumber, readSearchText } from "@/lib/list-params";
import { Link } from "@/lib/navigation";
import { ALL_ROLES } from "@/lib/roles";
import { countUsersByRole, listUsersForAdmin } from "@/lib/services/user";

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminUsers");
  return { title: t("title") };
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const filter = {
    role: readChoice(params.role, ALL_ROLES),
    query: readSearchText(params.q),
    page: readPageNumber(params.page),
  };
  const [{ users, total, pageCount }, roleCounts] = await Promise.all([
    listUsersForAdmin(filter),
    countUsersByRole(),
  ]);

  const t = await getTranslations("AdminUsers");
  const tRoles = await getTranslations("Roles");
  const format = await getFormatter();
  const locale = await getLocale();

  /** The address of this list for one role (or all roles), back on page 1. */
  const hrefWithRole = (role: Role | null) => listHref("/admin/users", { role, q: filter.query });
  const roleLinks: FilterLink[] = [
    { href: hrefWithRole(null), label: t("allRoles"), active: filter.role === null },
    ...ALL_ROLES.map((role) => ({
      href: hrefWithRole(role),
      label: `${tRoles(role)} (${format.number(roleCounts[role] ?? 0)})`,
      active: filter.role === role,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild size="lg">
            <Link href="/admin/users/new">
              <UserPlus aria-hidden />
              {t("addStaff")}
            </Link>
          </Button>
        }
      />

      <FilterLinks links={roleLinks} label={t("filterLabel")} />
      <SearchBox path="/admin/users" query={filter.query} placeholder={t("searchPlaceholder")} keep={{ role: filter.role }} />
      <p className="text-sm text-muted-foreground">{t("found", { count: total })}</p>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center font-semibold">{t("empty")}</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {users.map((user) => {
            // One more line about the account, depending on the role.
            let extra: string | null = null;
            if (user.providerProfile?.businessName) {
              extra = user.providerProfile.businessName;
            } else if (user.operatorProfile) {
              extra = t("worksFor", { name: user.operatorProfile.provider.name });
            } else if (user.officerProfile) {
              extra = pickByLocale(user.officerProfile.upazila.name, user.officerProfile.upazila.nameBn, locale);
            }
            return (
              <li key={user.id}>
                <Card className="h-full">
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{localizeDigits(user.phone, locale)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{tRoles(user.role)}</Badge>
                        <StatusBadge status={user.status} />
                      </div>
                    </div>
                    {extra && <p className="text-sm">{extra}</p>}
                    <p className="text-sm text-muted-foreground">
                      {t("joined", { date: format.dateTime(user.createdAt, { dateStyle: "medium" }) })}
                    </p>
                    {user.id === admin.id ? (
                      <p className="text-sm text-muted-foreground">{t("thisIsYou")}</p>
                    ) : (
                      <UserStatusButton userId={user.id} status={user.status} />
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <PageLinks
        page={filter.page}
        pageCount={pageCount}
        hrefFor={(page) => listHref("/admin/users", { role: filter.role, q: filter.query, page })}
      />
    </div>
  );
}
