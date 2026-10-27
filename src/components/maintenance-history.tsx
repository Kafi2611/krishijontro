// A machine's service history: every repair and service, newest first, with its step, what was
// wrong, who took it, and (once fixed) the parts, the cost and the technician's note.
// Used on the provider's machine page and on the technician's request page.
import { useFormatter, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/status-badge";
import type { MaintenanceStatus, MaintenanceType } from "@/generated/prisma/enums";

type HistoryItem = {
  id: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  description: string;
  partsUsed: string | null;
  partsCost: number;
  labourCost: number;
  technicianNote: string | null;
  fixedAt: Date | null;
  createdAt: Date;
  technician: { name: string } | null;
};

export function MaintenanceHistory({ items }: { items: HistoryItem[] }) {
  const t = useTranslations("Maintenance");
  const format = useFormatter();

  if (items.length === 0) {
    return <p className="text-muted-foreground">{t("historyEmpty")}</p>;
  }

  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.id} className="space-y-1 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{t(`types.${item.type}`)}</p>
            <StatusBadge status={item.status} />
          </div>
          <p>{item.description}</p>
          <p className="text-sm text-muted-foreground">
            {t("requestedOn", { date: format.dateTime(item.createdAt, { dateStyle: "medium" }) })}
            {" · "}
            {item.technician ? t("takenBy", { name: item.technician.name }) : t("notTakenYet")}
          </p>
          {item.fixedAt && (
            <div className="space-y-1 rounded-lg bg-muted p-2 text-sm">
              <p>{t("fixedOn", { date: format.dateTime(item.fixedAt, { dateStyle: "medium" }) })}</p>
              {item.partsUsed && <p>{t("parts", { parts: item.partsUsed })}</p>}
              <p>{t("cost", { total: item.partsCost + item.labourCost, parts: item.partsCost, labour: item.labourCost })}</p>
              {item.technicianNote && <p>{t("note", { note: item.technicianNote })}</p>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
