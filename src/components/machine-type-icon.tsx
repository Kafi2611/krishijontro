// Shows the icon of a machine type. MachineType.icon in the database stores a
// lucide-react icon NAME (e.g. "Tractor"); this component turns it into the icon.
import {
  Droplets,
  Leaf,
  Scissors,
  Shovel,
  SprayCan,
  Sprout,
  Tractor,
  Wheat,
  type LucideIcon,
} from "lucide-react";

const MACHINE_ICONS: Record<string, LucideIcon> = {
  Tractor,
  Shovel, // power tiller (tilling)
  Wheat, // combine harvester
  Scissors, // reaper (cutting)
  Sprout, // rice transplanter
  Droplets, // irrigation pump
  Leaf, // seeder
  SprayCan, // sprayer
};

type MachineTypeIconProps = {
  icon: string;
  className?: string;
};

export function MachineTypeIcon({ icon, className }: MachineTypeIconProps) {
  // Unknown name -> show a tractor, so the page never breaks.
  const Icon = MACHINE_ICONS[icon] ?? Tractor;
  return <Icon className={className} aria-hidden />;
}
