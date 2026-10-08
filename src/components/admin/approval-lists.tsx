// The three lists on the admin's approvals page: providers, machines and operators
// that wait for a decision. Each card shows what the admin needs to check, plus the
// Approve / Reject buttons. These are Server Components: they read the database directly.
import { CircleCheckBig, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ApprovalActions } from "@/components/admin/approval-actions";
import { DetailRow } from "@/components/detail-row";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import {
  listPendingMachines,
  listPendingOperators,
  listPendingProviders,
} from "@/lib/services/approval";

/** Shown when a list has nothing waiting. */
async function NothingWaiting() {
  const t = await getTranslations("Approvals");
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <CircleCheckBig className="size-12 text-primary" aria-hidden />
        <p className="font-semibold">{t("nothingWaiting")}</p>
      </CardContent>
    </Card>
  );
}

/** A phone number that opens the dialer when tapped. */
function PhoneLink({ phone, locale }: { phone: string; locale: string }) {
  return (
    <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-primary">
      <Phone className="size-4" aria-hidden />
      {localizeDigits(phone, locale)}
    </a>
  );
}

/** "Upazila, District" in the reader's language. */
function placeName(
  location: { name: string; nameBn: string; parent: { name: string; nameBn: string } | null } | null,
  locale: string,
): string {
  if (!location) {
    return "—";
  }
  const upazila = pickByLocale(location.name, location.nameBn, locale);
  if (!location.parent) {
    return upazila;
  }
  return `${upazila}, ${pickByLocale(location.parent.name, location.parent.nameBn, locale)}`;
}

// ─────────────────────────── Providers ───────────────────────────

export async function PendingProviders() {
  const providers = await listPendingProviders();
  const t = await getTranslations("Approvals");
  const tProviderTypes = await getTranslations("ProviderTypes");
  const format = await getFormatter();
  const locale = await getLocale();

  if (providers.length === 0) {
    return <NothingWaiting />;
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {providers.map((provider) => (
        <li key={provider.id}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">{provider.businessName ?? provider.user.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {provider.user.name} · <PhoneLink phone={provider.user.phone} locale={locale} />
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl>
                <DetailRow label={t("providerType")}>{tProviderTypes(provider.providerType)}</DetailRow>
                <DetailRow label={t("nid")}>
                  {provider.nid ? localizeDigits(provider.nid, locale) : t("missing")}
                </DetailRow>
                <DetailRow label={t("tradeLicense")}>{provider.tradeLicenseNo ?? "—"}</DetailRow>
                <DetailRow label={t("address")}>
                  {provider.address ?? t("missing")}
                  <span className="block text-sm font-normal text-muted-foreground">
                    {placeName(provider.location, locale)}
                  </span>
                </DetailRow>
                <DetailRow label={t("payoutAccount")}>{provider.payoutAccount ?? t("missing")}</DetailRow>
                <DetailRow label={t("machines")}>{format.number(provider.user._count.machines)}</DetailRow>
                <DetailRow label={t("registered")}>
                  {format.dateTime(provider.user.createdAt, { dateStyle: "medium" })}
                </DetailRow>
              </dl>
              <ApprovalActions target="providers" id={provider.userId} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────── Machines ───────────────────────────

export async function PendingMachines() {
  const machines = await listPendingMachines();
  const t = await getTranslations("Approvals");
  const tMoney = await getTranslations("Money");
  const format = await getFormatter();
  const locale = await getLocale();

  if (machines.length === 0) {
    return <NothingWaiting />;
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {machines.map((machine) => {
        const providerProfile = machine.provider.providerProfile;
        // OpenStreetMap link, so the admin can see where the machine is kept
        const mapUrl = `https://www.openstreetmap.org/?mlat=${machine.lat}&mlon=${machine.lng}#map=15/${machine.lat}/${machine.lng}`;
        return (
          <li key={machine.id}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <MachineTypeIcon icon={machine.machineType.icon} className="size-6" />
                  </span>
                  <div>
                    <CardTitle className="text-lg">
                      {machine.brand} {machine.model}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {pickByLocale(machine.machineType.name, machine.machineType.nameBn, locale)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {machine.images.length > 0 ? (
                  <ul className="grid grid-cols-3 gap-2">
                    {machine.images.map((image) => (
                      <li key={image.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                        <Image src={image.url} alt={`${machine.brand} ${machine.model}`} fill sizes="160px" className="object-cover" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("noPhotos")}</p>
                )}
                <dl>
                  <DetailRow label={t("owner")}>
                    {providerProfile?.businessName ?? machine.provider.name}
                    <span className="mt-1 flex justify-end">
                      {providerProfile && <StatusBadge status={providerProfile.approvalStatus} />}
                    </span>
                  </DetailRow>
                  <DetailRow label={t("rate")}>
                    {tMoney("rate", { amount: machine.rate, unit: machine.machineType.billingUnit })}
                  </DetailRow>
                  <DetailRow label={t("year")}>{localizeDigits(machine.year, locale)}</DetailRow>
                  <DetailRow label={t("horsePower")}>
                    {machine.horsePower ? format.number(machine.horsePower) : "—"}
                  </DetailRow>
                  <DetailRow label={t("registrationNo")}>{machine.registrationNo ?? "—"}</DetailRow>
                  <DetailRow label={t("place")}>
                    {placeName(machine.location, locale)}
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center justify-end gap-1 text-sm font-normal text-primary"
                    >
                      <MapPin className="size-4" aria-hidden />
                      {t("openMap")}
                    </a>
                  </DetailRow>
                  <DetailRow label={t("added")}>
                    {format.dateTime(machine.createdAt, { dateStyle: "medium" })}
                  </DetailRow>
                </dl>
                {machine.description && <p className="text-sm whitespace-pre-line">{machine.description}</p>}
                <ApprovalActions target="machines" id={machine.id} />
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────── Operators ───────────────────────────

export async function PendingOperators() {
  const operators = await listPendingOperators();
  const t = await getTranslations("Approvals");
  const tProfile = await getTranslations("Profile");
  const format = await getFormatter();
  const locale = await getLocale();

  if (operators.length === 0) {
    return <NothingWaiting />;
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {operators.map((operator) => (
        <li key={operator.id}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">{operator.user.name}</CardTitle>
              <p className="text-sm">
                <PhoneLink phone={operator.user.phone} locale={locale} />
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl>
                <DetailRow label={t("worksFor")}>
                  {operator.provider.providerProfile?.businessName ?? operator.provider.name}
                </DetailRow>
                <DetailRow label={t("licenseNo")}>{operator.licenseNo ?? "—"}</DetailRow>
                <DetailRow label={t("experience")}>
                  {tProfile("experienceValue", { years: operator.experienceYears })}
                </DetailRow>
                <DetailRow label={t("added")}>
                  {format.dateTime(operator.user.createdAt, { dateStyle: "medium" })}
                </DetailRow>
              </dl>
              <ApprovalActions target="operators" id={operator.userId} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
