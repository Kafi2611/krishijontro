// A small coloured label for a status, in the reader's language:
// green = good (Approved, Active), yellow = waiting (Pending), red = Rejected/Suspended,
// orange = Under repair, grey = Not renting.
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type messages from "../../messages/en.json";

/** Any status that has a word in the "Status" section of messages/en.json. */
export type StatusKey = keyof (typeof messages)["Status"];

const STATUS_COLORS: Record<StatusKey, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  APPROVED: "bg-green-100 text-green-800",
  VERIFIED: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-900",
  REJECTED: "bg-red-100 text-red-800",
  SUSPENDED: "bg-red-100 text-red-800",
  UNDER_MAINTENANCE: "bg-orange-100 text-orange-900",
  INACTIVE: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: StatusKey; className?: string }) {
  const t = useTranslations("Status");
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_COLORS[status], className)}>
      {t(status)}
    </Badge>
  );
}
