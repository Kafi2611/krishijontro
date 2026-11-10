// Cooperative leader page: one group booking (/cooperative/group-bookings/<id>).
// The machine and its provider (with a call button), the one delivery charge and how it is
// shared, and every member's plot in the order the machine visits them: who, when, how much
// land, the status and what they pay. Each member follows their own booking (codes, payment)
// on their own phone. Only the leader who made it can open it.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ContactLine } from "@/components/booking/contact-line";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getFormatter } from "@/lib/format-server";
import { localizeDigits, pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { getAmountDue } from "@/lib/services/booking-rules";
import { getGroupBooking } from "@/lib/services/group-booking";
import { countGroupProgress } from "@/lib/services/group-booking-rules";

type GroupBookingPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GroupBooking");
  return { title: t("groupTitle") };
}

export default async function GroupBookingPage({ params }: GroupBookingPageProps) {
  const leader = await requireRole("COOP_LEADER");
  const { id } = await params;
  const group = await getGroupBooking(id, leader.id);
  if (!group) {
    notFound(); // no such group booking, or another leader's
  }
  const t = await getTranslations("GroupBooking");
  const tWork = await getTranslations("WorkTypes");
  const tPrice = await getTranslations("Price");
  const tView = await getTranslations("BookingView");
  const format = await getFormatter();
  const locale = await getLocale();
  const provider = group.machine.provider;
  const progress = countGroupProgress(group.bookings);
  const timeText = (date: Date) => format.dateTime(date, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/cooperative/group-bookings">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>

      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <MachineTypeIcon icon={group.machine.machineType.icon} className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {group.machine.brand} {group.machine.model}
          </h1>
          <p className="text-muted-foreground">
            {pickByLocale(group.machine.machineType.name, group.machine.machineType.nameBn, locale)} · {tWork(group.workType)} ·{" "}
            {group.village}
          </p>
          <p className="text-muted-foreground">{format.dateTime(group.startAt, { dateStyle: "full", timeStyle: "short" })}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <ContactLine label={tView("provider")} name={provider.providerProfile?.businessName ?? provider.name} phone={provider.phone} />
          <p className="rounded-lg bg-accent p-3 text-sm">
            {t("deliveryNote", { total: group.totalDeliveryCharge, count: group.bookings.length })}
          </p>
          <p className="text-sm">{t("progress", progress)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("plotsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {group.bookings.map((booking, index) => (
              <li key={booking.id} className="space-y-1 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {format.number(index + 1)}. {booking.farmer.name}
                  </p>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {localizeDigits(booking.code, locale)} · {timeText(booking.startAt)}–{timeText(booking.endAt)}
                  {booking.fieldAddress && ` · ${booking.fieldAddress}`}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {booking.billingUnit === "PER_ACRE"
                      ? tView("landValue", { land: booking.landDecimal })
                      : tView("quantity", { quantity: booking.quantity, unit: booking.billingUnit })}
                    {" · "}
                    {t("deliveryShare", { amount: booking.deliveryCharge })}
                    {booking.minimumShare > 0 && ` · ${t("minimumShare", { amount: booking.minimumShare })}`}
                  </span>
                  {/* A rejected or cancelled plot is not paid (only a late cancellation fee, if any) */}
                  <span className="font-semibold tabular-nums">
                    {tPrice("amount", { amount: getAmountDue(booking, booking.totalAmount) })}
                  </span>
                </div>
                <a href={`tel:${booking.farmer.phone}`} className="text-sm text-primary underline-offset-4 hover:underline">
                  {localizeDigits(booking.farmer.phone, locale)}
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">{t("membersFollowNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
