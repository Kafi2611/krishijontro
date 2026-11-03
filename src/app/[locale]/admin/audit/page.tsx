// Admin page: the audit log (/admin/audit?action=USER_SUSPENDED&page=2).
// Every important admin, officer and government action, newest first: what was done, by whom
// (name and role), when, and a short note. Filter buttons show one kind of action at a time.
// The log can only be read here, never changed (see lib/services/audit.ts).
import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { FilterLinks, PageLinks, type FilterLink } from "@/components/list-filters";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listHref, readPageNumber } from "@/lib/list-params";
import { countAuditActions, listAuditLogs } from "@/lib/services/audit";
import type messages from "../../../../../messages/en.json";

/** A kind of action that has a readable name in the "AuditActions" part of messages/en.json. */
type AuditActionKey = keyof (typeof messages)["AuditActions"];

type AdminAuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminAudit");
  return { title: t("title") };
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const actionCounts = await countAuditActions();
  // Only an action that is really in the log can be chosen (anything else shows every action).
  const chosen = typeof params.action === "string" ? params.action : null;
  const action = actionCounts.some((item) => item.action === chosen) ? chosen : null;
  const page = readPageNumber(params.page);
  const { rows, pageCount } = await listAuditLogs({ action, page });

  const t = await getTranslations("AdminAudit");
  const tActions = await getTranslations("AuditActions");
  const tRoles = await getTranslations("Roles");
  const format = await getFormatter();

  /** The readable name of an action code, or the code itself for a kind we have no name for. */
  const actionLabel = (code: string) => (tActions.has(code as AuditActionKey) ? tActions(code as AuditActionKey) : code);

  let allRows = 0;
  for (const item of actionCounts) {
    allRows += item.count;
  }
  const actionLinks: FilterLink[] = [
    { href: "/admin/audit", label: `${t("allActions")} (${format.number(allRows)})`, active: action === null },
    ...actionCounts.map((item) => ({
      href: listHref("/admin/audit", { action: item.action }),
      label: `${actionLabel(item.action)} (${format.number(item.count)})`,
      active: action === item.action,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <FilterLinks links={actionLinks} label={t("filterLabel")} />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ScrollText className="size-12 text-primary" aria-hidden />
            <p className="font-semibold">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{actionLabel(row.action)}</p>
                    <time dateTime={row.createdAt.toISOString()} className="text-sm text-muted-foreground">
                      {format.dateTime(row.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </div>
                  {row.details && <p className="text-sm">{row.details}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{row.actor ? t("by", { name: row.actor.name }) : t("bySystem")}</span>
                    {row.actor && <Badge variant="secondary">{tRoles(row.actor.role)}</Badge>}
                    <Badge variant="outline">{row.entityType}</Badge>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <PageLinks page={page} pageCount={pageCount} hrefFor={(nextPage) => listHref("/admin/audit", { action, page: nextPage })} />
    </div>
  );
}
