// The booking's steps from top to bottom, like a parcel tracker:
// a green tick for every step that happened (with when and who), a red cross if the booking
// was stopped (rejected / cancelled), and grey circles for the steps still to come.
// The list of steps is made by buildTimeline() in lib/services/booking-rules.ts.
import { Check, Circle, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { TimelineKey, TimelineStep } from "@/lib/services/booking-rules";
import { cn } from "@/lib/utils";

/** Steps that mean the booking stopped. They get a red cross instead of a green tick. */
const STOPPED_KEYS: TimelineKey[] = ["REJECTED", "CANCELLED", "BREAKDOWN", "DISPUTED"];

export function BookingTimeline({ steps }: { steps: TimelineStep[] }) {
  const t = useTranslations("Timeline");
  const format = useFormatter();

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const isStopped = STOPPED_KEYS.includes(step.key);
        const isLast = index === steps.length - 1;
        return (
          <li key={`${step.key}-${index}`} className="flex gap-3">
            {/* The dot, and a line down to the next dot */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  step.done && !isStopped && "bg-primary text-primary-foreground",
                  step.done && isStopped && "bg-destructive text-white",
                  !step.done && "border-2 border-muted-foreground/30 text-muted-foreground/40",
                )}
              >
                {step.done && !isStopped && <Check className="size-4" aria-hidden />}
                {step.done && isStopped && <X className="size-4" aria-hidden />}
                {!step.done && <Circle className="size-2 fill-current" aria-hidden />}
              </span>
              {!isLast && <span className={cn("w-0.5 flex-1", step.done ? "bg-primary/40" : "bg-muted")} />}
            </div>

            <div className={cn("min-w-0 pb-5", !step.done && "text-muted-foreground")}>
              <p className="font-medium">{t(step.key)}</p>
              {step.at && (
                <p className="text-sm text-muted-foreground">
                  {format.dateTime(step.at, { dateStyle: "medium", timeStyle: "short" })}
                  {step.actorName && ` · ${t("by", { name: step.actorName })}`}
                </p>
              )}
              {step.note && <p className="mt-1 rounded-md bg-muted px-2 py-1 text-sm">{t("reason", { note: step.note })}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
