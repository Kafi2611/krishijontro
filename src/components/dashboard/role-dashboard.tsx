// The (still empty) dashboard every role sees in Phase 1: a welcome line and a list
// of what this role will be able to do. Later phases replace the list with real widgets.
import { CircleDashed } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Role } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";

export async function RoleDashboard({ role }: { role: Role }) {
  const user = await requireUser();
  const t = await getTranslations("Dashboard");
  const tRoles = await getTranslations("Roles");
  const tFeatures = await getTranslations("Features");

  // t.raw gives the list exactly as written in the messages file (an array of sentences).
  const features = tFeatures.raw(role) as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("welcome", { name: user.name })}</h1>
        <p className="text-muted-foreground">{t("loggedInAs", { role: tRoles(role) })}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("featuresTitle")}</CardTitle>
          <CardDescription>{t("featuresNote")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 rounded-lg border p-3">
                <CircleDashed className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
