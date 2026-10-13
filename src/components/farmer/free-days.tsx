// The next 14 days of a machine as small boxes: green = free, grey = busy
// (another booking, or a day the owner blocked). Two rows of 7 days fit a phone.
import { useFormatter, useTranslations } from "next-intl";
import { startOfDhakaDay, type StripDay } from "@/lib/services/calendar";
import { cn } from "@/lib/utils";

export function FreeDays({ days }: { days: StripDay[] }) {
  const t = useTranslations("MachineView");
  const format = useFormatter(); // Bangla day names and digits on Bangla pages

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-7 gap-1.5">
        {days.map(({ day, state }) => {
          const date = startOfDhakaDay(day);
          const isFree = state === "free";
          return (
            <li
              key={day}
              className={cn(
                "flex flex-col items-center rounded-lg py-1.5 text-xs",
                isFree ? "bg-green-100 text-green-900" : "bg-muted text-muted-foreground",
              )}
            >
              <span>{format.dateTime(date, { weekday: "short" })}</span>
              <span className={cn("text-base font-semibold", !isFree && "line-through")}>
                {format.dateTime(date, { day: "numeric" })}
              </span>
              {/* The colour alone does not help screen readers, so say it in words too */}
              <span className="sr-only">{isFree ? t("dayFree") : t("dayBusy")}</span>
            </li>
          );
        })}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-green-200" aria-hidden />
          {t("dayFree")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted-foreground/30" aria-hidden />
          {t("dayBusy")}
        </span>
      </p>
    </div>
  );
}
