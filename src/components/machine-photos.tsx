// The photos of a machine: the first one big, the others smaller below it.
// Without photos it shows the machine type's big icon and a short note instead.
// Used on the provider's and the farmer's machine pages.
import Image from "next/image";
import { MachineTypeIcon } from "@/components/machine-type-icon";

type MachinePhotosProps = {
  images: { id: string; url: string }[];
  name: string; // e.g. "Mahindra 575 DI", used as the photos' alt text
  icon: string; // the machine type's icon, shown when there are no photos
  emptyText: string; // the note shown when there are no photos
};

export function MachinePhotos({ images, name, icon, emptyText }: MachinePhotosProps) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-accent p-8 text-center">
        <MachineTypeIcon icon={icon} className="size-14 text-primary" />
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2">
      {images.map((image, index) => (
        // The first photo is shown big (across both columns)
        <li
          key={image.id}
          className={`relative overflow-hidden rounded-lg bg-muted ${index === 0 ? "col-span-2 aspect-[4/3]" : "aspect-square"}`}
        >
          <Image
            src={image.url}
            alt={name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority={index === 0}
          />
        </li>
      ))}
    </ul>
  );
}
