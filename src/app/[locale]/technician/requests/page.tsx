// Technician page: "Repair requests" (/technician/requests). Three lists: new requests nobody
// has taken yet (the oldest first, they waited longest), the technician's own open jobs, and the
// jobs they fixed lately. Each card opens the request's page.
import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { RequestCard } from "@/components/technician/request-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listTechnicianRequests } from "@/lib/services/maintenance";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Technician");
  return { title: t("title") };
}

export default async function TechnicianRequestsPage() {
  const technician = await requireRole("TECHNICIAN");
  const lists = await listTechnicianRequests(technician.id);
  const t = await getTranslations("Technician");

  const sections = [
    { key: "mine", title: t("mineTitle"), requests: lists.mine },
    { key: "new", title: t("newTitle"), requests: lists.newRequests },
    { key: "done", title: t("doneTitle"), requests: lists.done },
  ];
  const hasAny = sections.some((section) => section.requests.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {!hasAny && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Wrench className="size-12 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">{t("noneHere")}</p>
          </CardContent>
        </Card>
      )}

      {hasAny &&
        sections.map((section) => (
          <section key={section.key} className="space-y-3" aria-labelledby={`${section.key}-title`}>
            <h2 id={`${section.key}-title`} className="text-xl font-bold">
              {section.title}
            </h2>
            {section.requests.length === 0 ? (
              <p className="text-muted-foreground">{t("noneHere")}</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {section.requests.map((request) => (
                  <li key={request.id}>
                    <RequestCard request={request} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
    </div>
  );
}
