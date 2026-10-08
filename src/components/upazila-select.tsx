"use client";
// A drop-down to choose an upazila. Upazilas are grouped under their district,
// and names are shown in the reader's language.
import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pickByLocale } from "@/lib/i18n";
import type { UpazilaOption } from "@/lib/services/location";

type UpazilaSelectProps = {
  id: string; // so a <label htmlFor> can point to it
  value: string;
  onChange: (upazilaId: string) => void;
  upazilas: UpazilaOption[];
  placeholder: string;
  invalid?: boolean;
};

/** Groups the upazila list by district: [[Paba, Godagari...], [Savar, Dhamrai...]]. */
function groupByDistrict(upazilas: UpazilaOption[]): UpazilaOption[][] {
  const groups = new Map<string, UpazilaOption[]>();
  for (const upazila of upazilas) {
    const list = groups.get(upazila.districtName) ?? [];
    list.push(upazila);
    groups.set(upazila.districtName, list);
  }
  return Array.from(groups.values());
}

export function UpazilaSelect({ id, value, onChange, upazilas, placeholder, invalid }: UpazilaSelectProps) {
  const locale = useLocale();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groupByDistrict(upazilas).map((district) => (
          <SelectGroup key={district[0].districtName}>
            <SelectLabel>
              {pickByLocale(district[0].districtName, district[0].districtNameBn, locale)}
            </SelectLabel>
            {district.map((upazila) => (
              <SelectItem key={upazila.id} value={upazila.id}>
                {pickByLocale(upazila.name, upazila.nameBn, locale)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
