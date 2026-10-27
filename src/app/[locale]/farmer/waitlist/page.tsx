// Farmer page: "Waitlist" (/farmer/waitlist). The machines the farmer is waiting for, newest
// first: the kind of machine, the work, the land, the day, and the status (waiting / told that a
// machine may be free / cancelled). An open entry can be left. Farmers join from the search page
// when no machine is free, or by themselves after a breakdown with no replacement.
import { Hourglass, Search } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { LeaveWaitlistButton } from "@/components/farmer/leave-waitlist-button";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { listFarmerWaitlist } from "@/lib/services/waitlist";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Waitlist");
  return { title: t("title") };
}

export default async function FarmerWaitlistPage() {
  const farmer = await requireRole("FARMER");
  const entries = await listFarmerWaitlist(farmer.id);
  const t = await getTranslations("Waitlist");
  const tWork = await getTranslations("WorkTypes");
  const tView = await getTranslations("BookingView");
  const format = await getFormatter();
  const locale = await getLocale();

  const findButton = (
    <Button asChild size="lg">
      <Link href="/farmer/search">
        <Search aria-hidden />
        {t("find")}
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={findButton} />

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Hourglass className="size-12 text-muted-foreground" aria-hidden />
            <p className="max-w-md text-muted-foreground">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {entries.map((entry) => {
            const isOpen = entry.status === "WAITING" || entry.status === "NOTIFIED";
            return (
              <li key={entry.id}>
                <Card>
                  <CardContent className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                      <MachineTypeIcon icon={entry.machineType.icon} className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{pickByLocale(entry.machineType.name, entry.machineType.nameBn, locale)}</p>
                        <StatusBadge status={entry.status} />
                      </div>
                      <p className="text-sm">
                        {tWork(entry.workType)} · {tView("landValue", { land: entry.landDecimal })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("wantedDay", { day: format.dateTime(entry.wantedDate, { dateStyle: "medium" }) })}
                      </p>
                      {entry.notifiedAt && (
                        <p className="text-sm text-sky-900">
                          {t("notifiedAt", { time: format.dateTime(entry.notifiedAt, { dateStyle: "medium", timeStyle: "short" }) })}
                        </p>
                      )}
                      {isOpen && <LeaveWaitlistButton entryId={entry.id} />}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
