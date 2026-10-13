// A green note above the search results: which machine type suits this job and why
// (from the rule table in lib/services/suggest.ts), with a button to show only that type,
// or to show all machines again when only that type is shown.
import { Lightbulb } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MachineTypeIcon } from "@/components/machine-type-icon";
import { Button } from "@/components/ui/button";
import { pickByLocale } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import type { PricedMachineType } from "@/lib/services/pricing-rule";
import type { SuggestionReason } from "@/lib/services/suggest";
import { searchInputToQuery, type MachineSearchInput } from "@/lib/validators/search";

type SuggestionNoteProps = {
  machineType: PricedMachineType; // the suggested type
  reason: SuggestionReason;
  search: MachineSearchInput; // the current search, to build the button's link
};

export function SuggestionNote({ machineType, reason, search }: SuggestionNoteProps) {
  const t = useTranslations("Search");
  const tReason = useTranslations("Suggestion");
  const locale = useLocale();

  const name = pickByLocale(machineType.name, machineType.nameBn, locale);
  const isShowingOnlyThis = search.machineTypeId === machineType.id;
  // The same search, with the machine filter switched on (this type) or off ("").
  const buttonSearch = { ...search, machineTypeId: isShowingOnlyThis ? "" : machineType.id };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-950 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-primary">
        <MachineTypeIcon icon={machineType.icon} className="size-6" />
      </span>
      <div className="flex-1 space-y-0.5">
        <p className="flex items-center gap-1.5 font-semibold">
          <Lightbulb className="size-4" aria-hidden />
          {t("suggestionTitle", { name })}
        </p>
        <p className="text-sm">{tReason(reason)}</p>
      </div>
      <Button asChild variant="outline" className="bg-white">
        <Link href={`/farmer/search?${searchInputToQuery(buttonSearch)}`}>
          {isShowingOnlyThis ? t("showAll") : t("showOnly", { name })}
        </Link>
      </Button>
    </div>
  );
}
