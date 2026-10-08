// The home page (/en or /bn): what KrishiJontro is, the machines you can book
// (read from the database, so a type the admin adds shows up here too),
// and the 4 steps of a booking.
import { ArrowRight, Banknote, CalendarCheck, KeyRound, Search } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { listActiveMachineTypes } from "@/lib/services/machine-type";

// The 4 steps of a booking, each with an icon.
const STEPS = [
  { titleKey: "step1Title", textKey: "step1Text", Icon: Search },
  { titleKey: "step2Title", textKey: "step2Text", Icon: CalendarCheck },
  { titleKey: "step3Title", textKey: "step3Text", Icon: KeyRound },
  { titleKey: "step4Title", textKey: "step4Text", Icon: Banknote },
] as const;

export default async function HomePage() {
  const t = await getTranslations("Home");
  const format = await getFormatter(); // writes numbers in Bangla digits on /bn pages
  const locale = await getLocale();
  const machineTypes = await listActiveMachineTypes();

  return (
    <>
      {/* Big green welcome section */}
      <section className="bg-gradient-to-b from-accent to-background">
        <div className="mx-auto max-w-5xl px-4 py-12 text-center sm:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
            {t("heroText")}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/farmer">
                {t("findMachine")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register">{t("listMachine")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Machine types */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="mb-6 text-center text-2xl font-bold">{t("machinesTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {machineTypes.map((machineType) => (
            <Card key={machineType.id} className="py-5">
              <CardContent className="flex flex-col items-center gap-3 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
                  <MachineTypeIcon icon={machineType.icon} className="size-7" />
                </span>
                <span className="font-medium">
                  {pickByLocale(machineType.name, machineType.nameBn, locale)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 pb-14">
        <h2 className="mb-6 text-center text-2xl font-bold">{t("howTitle")}</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.titleKey} className="flex gap-4 rounded-xl border bg-card p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <step.Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">
                  {format.number(index + 1)}. {t(step.titleKey)}
                </p>
                <p className="text-sm text-muted-foreground">{t(step.textKey)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
