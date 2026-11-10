// Cooperative leader page: the group booking history (/cooperative/group-bookings).
// Newest first: the machine, the work, the day, how many plots and how far they are (e.g.
// "2 accepted, 1 waiting"), and what the members pay together. Each card opens the group.
import { CalendarPlus, CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getFormatter } from "@/lib/format-server";
import { Link } from "@/lib/navigation";
import { countGroupProgress } from "@/lib/services/group-booking-rules";
import { listGroupBookings } from "@/lib/services/group-booking";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GroupBooking");
  return { title: t("historyTitle") };
}

export default async function GroupBookingsPage() {
  const leader = await requireRole("COOP_LEADER");
  const groups = await listGroupBookings(leader.id);
  const t = await getTranslations("GroupBooking");
  const tWork = await getTranslations("WorkTypes");
  const tPrice = await getTranslations("Price");
  const format = await getFormatter();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("historyTitle")}
        description={t("historySubtitle")}
        actions={
          <Button asChild size="lg">
            <Link href="/cooperative/group-bookings/new">
              <CalendarPlus aria-hidden />
              {t("newTitle")}
            </Link>
          </Button>
        }
      />

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarRange className="size-12 text-primary" aria-hidden />
            <p className="font-semibold">{t("historyEmpty")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {groups.map((group) => {
            const progress = countGroupProgress(group.bookings);
            return (
              <li key={group.id}>
                <Link
                  href={`/cooperative/group-bookings/${group.id}`}
                  className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="flex items-start gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                        <MachineTypeIcon icon={group.machine.machineType.icon} className="size-6" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">
                            {group.machine.brand} {group.machine.model}
                          </p>
                          <span className="font-semibold tabular-nums">{tPrice("amount", { amount: progress.total })}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {tWork(group.workType)} · {format.dateTime(group.startAt, { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                        <p className="text-sm">{t("progress", progress)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
