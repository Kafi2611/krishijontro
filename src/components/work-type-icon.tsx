// Shows an icon for a kind of work (tilling, harvesting...), using the same icons as
// the machines that do that work, so farmers can find the work by its picture.
import { MachineTypeIcon } from "@/components/machine-type-icon";
import type { WorkType } from "@/generated/prisma/enums";
import type { MachineIconName } from "@/lib/validators/machine-type";

const WORK_TYPE_ICONS: Record<WorkType, MachineIconName> = {
  TILLING: "Tractor",
  HARVESTING: "Wheat",
  TRANSPLANTING: "Sprout",
  IRRIGATION: "Droplets",
  SEEDING: "Leaf",
  SPRAYING: "SprayCan",
};

export function WorkTypeIcon({ workType, className }: { workType: WorkType; className?: string }) {
  return <MachineTypeIcon icon={WORK_TYPE_ICONS[workType]} className={className} />;
}
