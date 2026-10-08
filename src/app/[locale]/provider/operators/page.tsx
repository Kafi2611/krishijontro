// Provider page: "Operators" — the drivers who work for this provider,
// with their approval status, and a button to add a new one.
import { Phone, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import { listProviderOperators } from "@/lib/services/operator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Operators");
  return { title: t("title") };
}

export default async function OperatorsPage() {
  const provider = await requireRole("PROVIDER");
  const operators = await listProviderOperators(provider.id);
  const t = await getTranslations("Operators");
  const tProfile = await getTranslations("Profile");
  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild size="lg">
            <Link href="/provider/operators/new">
              <Plus aria-hidden />
              {t("add")}
            </Link>
          </Button>
        }
      />

      {operators.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Users className="size-12 text-muted-foreground" aria-hidden />
            <p className="font-semibold">{t("empty")}</p>
            <p className="max-w-md text-muted-foreground">{t("emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {operators.map((operator) => (
            <li key={operator.id}>
              <Card className="h-full">
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-semibold">{operator.name}</p>
                    {operator.operatorProfile && (
                      <StatusBadge status={operator.operatorProfile.approvalStatus} />
                    )}
                  </div>
                  {/* tel: link -> tapping the number opens the phone's dialer */}
                  <a href={`tel:${operator.phone}`} className="flex items-center gap-2 text-primary">
                    <Phone className="size-4" aria-hidden />
                    {localizeDigits(operator.phone, locale)}
                  </a>
                  {operator.operatorProfile && (
                    <p className="text-sm text-muted-foreground">
                      {tProfile("experienceValue", { years: operator.operatorProfile.experienceYears })}
                      {operator.operatorProfile.licenseNo &&
                        ` · ${t("licenseShort")} ${operator.operatorProfile.licenseNo}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
