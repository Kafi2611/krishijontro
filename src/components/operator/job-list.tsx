// The operator's jobs as titled sections of cards ("To do now", "Coming up", "Done").
// Each card opens the job screen. Used by "My jobs" and the operator dashboard.
// If every section is empty, one box with emptyText (or "no jobs yet") is shown instead.
import { useTranslations } from "next-intl";
import { BookingCard } from "@/components/booking/booking-card";
import { Card, CardContent } from "@/components/ui/card";
import type { BookingStatus } from "@/generated/prisma/enums";

/** The booking fields a job card needs. */
type JobForList = {
  id: string;
  code: string;
  status: BookingStatus;
  startAt: Date;
  fieldAddress: string | null;
  machine: { brand: string; model: string; machineType: { icon: string } };
  farmer: { name: string };
};

type OperatorJobListProps = {
  sections: { key: string; title: string; jobs: JobForList[] }[];
  emptyIcon: React.ReactNode;
  emptyText?: string; // the dashboard says "nothing to do now" instead of "no jobs yet"
};

export function OperatorJobList({ sections, emptyIcon, emptyText }: OperatorJobListProps) {
  const t = useTranslations("OperatorJobs");
  const hasAny = sections.some((section) => section.jobs.length > 0);

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          {emptyIcon}
          <p className="max-w-md text-muted-foreground">{emptyText ?? t("empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.key} className="space-y-3" aria-labelledby={`${section.key}-title`}>
          <h2 id={`${section.key}-title`} className="text-xl font-bold">
            {section.title}
          </h2>
          {section.jobs.length === 0 ? (
            <p className="text-muted-foreground">{t("noneHere")}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {section.jobs.map((job) => (
                <li key={job.id}>
                  {/* Under the name: the farmer, and where the field is */}
                  <BookingCard
                    href={`/operator/jobs/${job.id}`}
                    code={job.code}
                    machineName={`${job.machine.brand} ${job.machine.model}`}
                    icon={job.machine.machineType.icon}
                    startAt={job.startAt}
                    status={job.status}
                    detail={job.fieldAddress ? `${job.farmer.name} · ${job.fieldAddress}` : job.farmer.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
