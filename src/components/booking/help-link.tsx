// "Ask for help about this booking": opens the Help form with this booking already chosen.
// Shown at the bottom of the farmer's and the provider's booking pages.
import { LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/navigation";

export function HelpLink({ bookingId }: { bookingId: string }) {
  const t = useTranslations("BookingView");
  return (
    <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
      <Link href={`/support/new?booking=${bookingId}`}>
        <LifeBuoy aria-hidden />
        {t("helpLink")}
      </Link>
    </Button>
  );
}
