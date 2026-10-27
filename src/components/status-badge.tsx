// A small coloured label for a status, in the reader's language:
// green = good (Approved, Active, Work done, Successful), yellow = waiting (Pending, Requested),
// blue = a booking on its way (Accepted ... Working), red = Rejected/Suspended/Complaint/Failed,
// orange = Under repair / Broken down, grey = Not renting / Cancelled.
// Breakdowns, repair steps and waitlist entries use the same colours.
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
  // Booking statuses
  REQUESTED: "bg-amber-100 text-amber-900",
  ACCEPTED: "bg-sky-100 text-sky-900",
  OPERATOR_ASSIGNED: "bg-sky-100 text-sky-900",
  ON_THE_WAY: "bg-blue-100 text-blue-900",
  WORKING: "bg-indigo-100 text-indigo-900",
  BREAKDOWN: "bg-orange-100 text-orange-900",
  COMPLETED: "bg-green-100 text-green-800",
  PAID: "bg-green-100 text-green-800",
  REVIEWED: "bg-green-100 text-green-800",
  CANCELLED: "bg-muted text-muted-foreground",
  DISPUTED: "bg-red-100 text-red-800",
  // Payment and refund statuses
  SUCCESS: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  PROCESSED: "bg-green-100 text-green-800",
  // Breakdown statuses (the search for a replacement machine)
  REPORTED: "bg-orange-100 text-orange-900",
  SEARCHING: "bg-orange-100 text-orange-900",
  REPLACED: "bg-green-100 text-green-800",
  NO_REPLACEMENT: "bg-red-100 text-red-800",
  // Repair and service steps
  RECEIVED: "bg-amber-100 text-amber-900",
  INSPECTING: "bg-sky-100 text-sky-900",
  REPAIRING: "bg-indigo-100 text-indigo-900",
  FIXED: "bg-green-100 text-green-800",
  // Waitlist statuses
  WAITING: "bg-amber-100 text-amber-900",
  NOTIFIED: "bg-sky-100 text-sky-900",
  BOOKED: "bg-green-100 text-green-800",
};

export function StatusBadge({ status, className }: { status: StatusKey; className?: string }) {
  const t = useTranslations("Status");
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_COLORS[status], className)}>
      {t(status)}
    </Badge>
  );
}
