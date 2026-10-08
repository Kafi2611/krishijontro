// Provider page: one machine's details (/provider/machines/<id>) — photos, facts,
// place on the map, approval status, and buttons to edit, open the availability
// calendar, stop/start renting or delete.
import { ArrowLeft, CalendarDays, CircleAlert, Clock, Pencil, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { DetailRow } from "@/components/detail-row";
import { MapPicker } from "@/components/map/map-picker";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { MachineActions } from "@/components/provider/machine-actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getProviderMachine } from "@/lib/services/machine";

type MachinePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MachineDetails");
  return { title: t("title") };
}

/** A coloured box with an icon and a message (used for pending / rejected / repair notes). */
function NoteBox({ tone, icon, children }: { tone: "amber" | "red" | "orange"; icon: React.ReactNode; children: React.ReactNode }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-red-200 bg-red-50 text-red-900",
    orange: "border-orange-200 bg-orange-50 text-orange-950",
  };
  return (
    <div role="status" className={`flex gap-3 rounded-lg border p-3 text-sm ${tones[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default async function MachinePage({ params }: MachinePageProps) {
  const provider = await requireRole("PROVIDER");
  const { id } = await params;
  const machine = await getProviderMachine(id, provider.id);
  if (!machine) {
    notFound(); // no such machine, or it belongs to another provider
  }

  const t = await getTranslations("MachineDetails");
  const tMoney = await getTranslations("Money");
  const tCommon = await getTranslations("Common");
  const format = await getFormatter();
  const locale = await getLocale();

  const upazila = machine.location;
  const district = upazila.parent;
  const serviceIsDue = machine.engineHours >= machine.serviceDueHours;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/provider/machines">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>

      {/* Title and buttons */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
            <MachineTypeIcon icon={machine.machineType.icon} className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">
              {machine.brand} {machine.model}
            </h1>
            <p className="text-muted-foreground">
              {pickByLocale(machine.machineType.name, machine.machineType.nameBn, locale)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/provider/machines/${machine.id}/edit`}>
              <Pencil aria-hidden />
              {tCommon("edit")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/provider/machines/${machine.id}/calendar`}>
              <CalendarDays aria-hidden />
              {t("calendar")}
            </Link>
          </Button>
          <MachineActions machineId={machine.id} status={machine.status} />
        </div>
      </div>

      {/* Notes about approval and repair */}
      {machine.approvalStatus === "PENDING" && (
        <NoteBox tone="amber" icon={<Clock className="size-5" aria-hidden />}>
          <p>{t("pendingNote")}</p>
        </NoteBox>
      )}
      {machine.approvalStatus === "REJECTED" && (
        <NoteBox tone="red" icon={<CircleAlert className="size-5" aria-hidden />}>
          <p className="font-semibold">{t("rejectedNote")}</p>
          {machine.rejectionReason && <p>{t("rejectedReason", { reason: machine.rejectionReason })}</p>}
          <p>{t("rejectedFix")}</p>
        </NoteBox>
      )}
      {machine.status === "UNDER_MAINTENANCE" && (
        <NoteBox tone="orange" icon={<Wrench className="size-5" aria-hidden />}>
          <p>{t("underRepairNote")}</p>
        </NoteBox>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle>{t("photos")}</CardTitle>
          </CardHeader>
          <CardContent>
            {machine.images.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg bg-accent p-8 text-center">
                <MachineTypeIcon icon={machine.machineType.icon} className="size-14 text-primary" />
                <p className="text-sm text-muted-foreground">{t("noPhotos")}</p>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {machine.images.map((image, index) => (
                  // The first photo is shown big (across both columns)
                  <li
                    key={image.id}
                    className={`relative overflow-hidden rounded-lg bg-muted ${index === 0 ? "col-span-2 aspect-[4/3]" : "aspect-square"}`}
                  >
                    <Image
                      src={image.url}
                      alt={`${machine.brand} ${machine.model}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                      priority={index === 0}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Facts */}
        <Card>
          <CardHeader>
            <CardTitle>{t("details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <DetailRow label={t("rate")}>
                {tMoney("rate", { amount: machine.rate, unit: machine.machineType.billingUnit })}
              </DetailRow>
              <DetailRow label={t("approval")}>
                <StatusBadge status={machine.approvalStatus} />
              </DetailRow>
              <DetailRow label={t("status")}>
                <StatusBadge status={machine.status} />
              </DetailRow>
              <DetailRow label={t("year")}>{localizeDigits(machine.year, locale)}</DetailRow>
              <DetailRow label={t("horsePower")}>
                {machine.horsePower ? format.number(machine.horsePower) : t("notSet")}
              </DetailRow>
              <DetailRow label={t("registrationNo")}>
                {machine.registrationNo ? localizeDigits(machine.registrationNo, locale) : t("notSet")}
              </DetailRow>
              <DetailRow label={t("place")}>
                {pickByLocale(upazila.name, upazila.nameBn, locale)}
                {district && `, ${pickByLocale(district.name, district.nameBn, locale)}`}
                {machine.address && <span className="block text-sm font-normal text-muted-foreground">{machine.address}</span>}
              </DetailRow>
              <DetailRow label={t("engine")}>
                {t("engineValue", { hours: machine.engineHours, due: machine.serviceDueHours })}
                {serviceIsDue && <span className="block text-sm text-orange-700">{t("serviceDue")}</span>}
              </DetailRow>
              <DetailRow label={t("bookings")}>{format.number(machine._count.bookings)}</DetailRow>
            </dl>
          </CardContent>
        </Card>
      </div>

      {machine.description && (
        <Card>
          <CardHeader>
            <CardTitle>{t("description")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line">{machine.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("location")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* No onChange -> a read-only map with the machine's pin */}
          <MapPicker value={{ lat: machine.lat, lng: machine.lng }} center={{ lat: machine.lat, lng: machine.lng }} />
        </CardContent>
      </Card>
    </div>
  );
}
