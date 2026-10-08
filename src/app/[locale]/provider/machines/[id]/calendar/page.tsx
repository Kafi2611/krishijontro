// Provider page: the availability calendar of one machine
// (/provider/machines/<id>/calendar?month=2026-10&day=2026-10-20).
// Shows the month with free / blocked / booked days, a form to block days,
// and the list of blocked days still to come.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AvailabilityCalendar } from "@/components/provider/availability-calendar";
import { BlockDaysForm } from "@/components/provider/block-days-form";
import { RemoveBlockButton } from "@/components/provider/remove-block-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { getMachineCalendar } from "@/lib/services/availability";
import { DAY_REGEX, MONTH_REGEX, toDhakaDay } from "@/lib/services/calendar";

type CalendarPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; day?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Calendar");
  return { title: t("title") };
}

export default async function MachineCalendarPage({ params, searchParams }: CalendarPageProps) {
  const provider = await requireRole("PROVIDER");
  const { id } = await params;
  const query = await searchParams;

  // Use the month from the URL if it looks right, otherwise this month.
  const thisMonth = toDhakaDay(new Date()).slice(0, 7);
  const month = query.month && MONTH_REGEX.test(query.month) ? query.month : thisMonth;
  const selectedDay = query.day && DAY_REGEX.test(query.day) ? query.day : undefined;

  const calendar = await getMachineCalendar(id, provider.id, month);
  if (!calendar) {
    notFound(); // no such machine, or not this provider's
  }
  const { machine, today, weeks, upcomingBlocks } = calendar;

  const t = await getTranslations("Calendar");
  const tDetails = await getTranslations("MachineDetails");
  const format = await getFormatter();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href={`/provider/machines/${machine.id}`}>
          <ArrowLeft aria-hidden />
          {tDetails("backToMachine")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={`${machine.brand} ${machine.model} · ${t("subtitle")}`} />

      <Card>
        <CardContent>
          <AvailabilityCalendar machineId={machine.id} month={month} weeks={weeks} selectedDay={selectedDay} />
        </CardContent>
      </Card>

      <Card id="block-form">
        <CardHeader>
          <CardTitle>{t("blockTitle")}</CardTitle>
          <CardDescription>{t("blockHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* key: when another day is tapped, React makes a fresh form with that day filled in */}
          <BlockDaysForm key={selectedDay ?? "none"} machineId={machine.id} today={today} startDay={selectedDay} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("upcomingTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBlocks.length === 0 ? (
            <p className="text-muted-foreground">{t("noBlocks")}</p>
          ) : (
            <ul className="divide-y">
              {upcomingBlocks.map((block) => {
                // endAt is the first FREE moment, so the last blocked day is one moment earlier.
                const lastBlockedMoment = new Date(block.endAt.getTime() - 1);
                return (
                  <li key={block.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">
                        {format.dateTimeRange(block.startAt, lastBlockedMoment, { dateStyle: "medium" })}
                      </p>
                      {block.reason && <p className="text-sm text-muted-foreground">{block.reason}</p>}
                    </div>
                    <RemoveBlockButton blockId={block.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
