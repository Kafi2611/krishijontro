// Cooperative leader page: a new group booking (/cooperative/group-bookings/new).
// One machine for many members' plots in the village, one plot after another; the delivery is
// charged once and shared equally. Without a cooperative (or with fewer than 2 members) it says
// what to do first.
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { GroupBookingForm } from "@/components/cooperative/group-booking-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/navigation";
import { toDhakaDay } from "@/lib/services/calendar";
import { getGroupFormData } from "@/lib/services/group-booking";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("GroupBooking");
  return { title: t("newTitle") };
}

export default async function NewGroupBookingPage() {
  const leader = await requireRole("COOP_LEADER");
  const data = await getGroupFormData(leader.id);
  const t = await getTranslations("GroupBooking");
  const locale = await getLocale();

  const backButton = (
    <Button asChild variant="ghost" className="-ml-3">
      <Link href="/cooperative/group-bookings">
        <ArrowLeft aria-hidden />
        {t("back")}
      </Link>
    </Button>
  );

  // Something must happen first: make the cooperative, or add at least 2 members.
  if (!data || data.members.length < 2) {
    return (
      <div className="space-y-6">
        {backButton}
        <PageHeader title={t("newTitle")} />
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p>{data ? t("needMembers") : t("needCooperative")}</p>
            <Button asChild size="lg">
              <Link href={data ? "/cooperative/members" : "/cooperative/setup"}>{data ? t("addMembers") : t("makeCooperative")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {backButton}
      <PageHeader title={t("newTitle")} description={t("newSubtitle", { name: data.cooperative.name })} />
      <GroupBookingForm
        members={data.members}
        machineTypes={data.machineTypes}
        defaultValues={data.defaultValues}
        today={toDhakaDay(new Date())}
        locale={locale}
      />
    </div>
  );
}
