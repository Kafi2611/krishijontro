// Technician page: one repair or service request (/technician/requests/<id>).
// At the top, the one thing to do now (Take this job / Start inspecting / Start repairing /
// Fixed with the parts and the cost), or the work done once it is fixed. Below: the request (and
// the breakdown it came from, with the operator's photo), the machine and its owner to call, and
// the machine's earlier service history.
// A technician can open a new request nobody has taken, or their own — never another technician's.
import { ArrowLeft, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ContactLine } from "@/components/booking/contact-line";
import { DetailRow } from "@/components/detail-row";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { MaintenanceHistory } from "@/components/maintenance-history";
import { StatusBadge } from "@/components/status-badge";
import { RequestActions } from "@/components/technician/request-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getTechnicianRequest } from "@/lib/services/maintenance";
import { getTechnicianStep } from "@/lib/services/maintenance-rules";

type TechnicianRequestPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Technician");
  return { title: t("title") };
}

export default async function TechnicianRequestPage({ params }: TechnicianRequestPageProps) {
  const technician = await requireRole("TECHNICIAN");
  const { id } = await params;
  const details = await getTechnicianRequest(id, technician.id);
  if (!details) {
    notFound(); // no such request, or another technician took it
  }
  const { request, history } = details;
  const { machine } = request;
  const step = getTechnicianStep(request, technician.id);

  const t = await getTranslations("Technician");
  const tMaintenance = await getTranslations("Maintenance");
  const tPrice = await getTranslations("Price");
  const format = await getFormatter();
  const locale = await getLocale();
  const providerName = machine.provider.providerProfile?.businessName ?? machine.provider.name;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href="/technician/requests">
            <ArrowLeft aria-hidden />
            {t("back")}
          </Link>
        </Button>
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
            <MachineTypeIcon icon={machine.machineType.icon} className="size-6" />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold">
              {machine.brand} {machine.model}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
              {tMaintenance(`types.${request.type}`)}
              <StatusBadge status={request.status} />
            </p>
          </div>
        </div>
      </div>

      {step && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-5 text-primary" aria-hidden />
              {t("nextTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RequestActions requestId={request.id} step={step} />
          </CardContent>
        </Card>
      )}

      {request.fixedAt && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle>{t("resultTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <DetailRow label={t("partsUsed")}>{request.partsUsed ?? "—"}</DetailRow>
              <DetailRow label={t("partsCost")}>{tPrice("amount", { amount: request.partsCost })}</DetailRow>
              <DetailRow label={t("labourCost")}>{tPrice("amount", { amount: request.labourCost })}</DetailRow>
              <DetailRow label={t("totalCost")}>{tPrice("amount", { amount: request.partsCost + request.labourCost })}</DetailRow>
              <DetailRow label={t("technicianNote")}>{request.technicianNote ?? "—"}</DetailRow>
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("requestTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl>
              <DetailRow label={t("problem")}>{request.description}</DetailRow>
              <DetailRow label={t("askedOn")}>{format.dateTime(request.createdAt, { dateStyle: "medium", timeStyle: "short" })}</DetailRow>
            </dl>
            {request.breakdownReport && (
              <div className="space-y-2 rounded-lg bg-orange-50 p-3 text-sm">
                <p className="font-semibold">
                  {t("fromBreakdown", { code: localizeDigits(request.breakdownReport.booking.code, locale) })}
                </p>
                {request.breakdownReport.photoUrl && (
                  <div className="relative aspect-[4/3] max-w-sm overflow-hidden rounded-lg bg-muted">
                    <Image src={request.breakdownReport.photoUrl} alt={t("photoAlt")} fill sizes="384px" className="object-cover" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("machineTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <DetailRow label={t("place")}>{pickByLocale(machine.location.name, machine.location.nameBn, locale)}</DetailRow>
              <DetailRow label={t("engine")}>
                {t("engineValue", { hours: machine.engineHours, due: machine.serviceDueHours })}
              </DetailRow>
            </dl>
            <ContactLine label={t("owner")} name={providerName} phone={machine.provider.phone} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("historyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MaintenanceHistory items={history} />
        </CardContent>
      </Card>
    </div>
  );
}
