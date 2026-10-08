// The month grid of the availability calendar. Each day is coloured:
// white = free, red = blocked by the provider, amber = booked, grey = past.
// Tapping a free day opens the same page with ?day=..., which fills the
// "Block days" form below with that day.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { addDays, addMonths, startOfDhakaDay, type CalendarDay, type DayState } from "@/lib/services/calendar";
import { cn } from "@/lib/utils";

// 1 January 2023 was a Sunday: the 7 days from it give us the weekday names in order.
const A_SUNDAY = "2023-01-01";

const DAY_STYLES: Record<DayState, string> = {
  free: "border bg-background hover:border-primary hover:bg-accent",
  blocked: "bg-red-100 text-red-900",
  booked: "bg-amber-100 text-amber-950",
  past: "text-muted-foreground/60",
};

type AvailabilityCalendarProps = {
  machineId: string;
  month: string; // "2026-10"
  weeks: CalendarDay[][];
  selectedDay?: string;
};

export function AvailabilityCalendar({ machineId, month, weeks, selectedDay }: AvailabilityCalendarProps) {
  const t = useTranslations("Calendar");
  const format = useFormatter();
  const locale = useLocale();
  const basePath = `/provider/machines/${machineId}/calendar`;

  const monthTitle = format.dateTime(startOfDhakaDay(`${month}-01`), { month: "long", year: "numeric" });
  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map((index) =>
    format.dateTime(startOfDhakaDay(addDays(A_SUNDAY, index)), { weekday: "short" }),
  );

  return (
    <div className="space-y-4">
      {/* Month name with previous / next buttons */}
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="icon" aria-label={t("prevMonth")}>
          <Link href={`${basePath}?month=${addMonths(month, -1)}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{monthTitle}</h2>
        <Button asChild variant="outline" size="icon" aria-label={t("nextMonth")}>
          <Link href={`${basePath}?month=${addMonths(month, 1)}`}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {weekdayNames.map((name) => (
          <div key={name} className="py-1">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const cellClass = cn(
            "flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-medium sm:text-base",
            DAY_STYLES[day.state],
            !day.inMonth && "opacity-40",
            day.isToday && "ring-2 ring-primary",
            day.day === selectedDay && "border-primary bg-accent",
          );
          const label = localizeDigits(day.dayOfMonth, locale);

          // Only free days can be tapped (to block them).
          if (day.state === "free") {
            return (
              <Link
                key={day.day}
                href={`${basePath}?month=${month}&day=${day.day}#block-form`}
                className={cellClass}
                aria-label={t("blockThisDay", { day: format.dateTime(startOfDhakaDay(day.day), { dateStyle: "long" }) })}
              >
                {label}
              </Link>
            );
          }
          return (
            <div key={day.day} className={cellClass} title={t(`legend.${day.state}`)}>
              {label}
            </div>
          );
        })}
      </div>

      {/* What the colours mean */}
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="size-4 rounded border bg-background" aria-hidden />
          {t("legend.free")}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-4 rounded bg-red-100" aria-hidden />
          {t("legend.blocked")}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-4 rounded bg-amber-100" aria-hidden />
          {t("legend.booked")}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-4 rounded ring-2 ring-primary" aria-hidden />
          {t("legend.today")}
        </li>
      </ul>
    </div>
  );
}
