// The Farmer dashboard: the first page a FARMER user sees after login.
// It shows a big "Find a machine" box (with a link to the price calculator)
// and the list of upcoming farmer features.
import { Calculator, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/lib/navigation";

export default async function FarmerDashboardPage() {
  const t = await getTranslations("FarmerDashboard");

  return (
    <RoleDashboard role="FARMER">
      <Card className="bg-accent">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Search className="size-7" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-lg font-semibold">{t("findTitle")}</p>
            <p className="text-muted-foreground">{t("findText")}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button asChild size="lg">
              <Link href="/farmer/search">
                <Search aria-hidden />
                {t("findButton")}
              </Link>
            </Button>
            <Button asChild variant="link" className="h-auto p-0">
              <Link href="/price-calculator">
                <Calculator aria-hidden />
                {t("calculator")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </RoleDashboard>
  );
}
