// A note on a booking that is part of a breakdown story:
// - "This booking replaces KJ-…" on the replacement booking (its parent broke down)
// - "The rest of the work: KJ-…" on the broken booking (its replacement)
// With `hrefBase` (the farmer owns both bookings) the codes are links; without it, plain text,
// because the replacement may belong to another provider, who cannot open it.
import { ArrowRightLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localizeDigits } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

type RelatedBooking = { id: string; code: string };

type RelatedBookingsProps = {
  parent: RelatedBooking | null; // the broken booking this one replaces
  replacements: RelatedBooking[]; // the booking(s) that finish this one's work
  hrefBase?: string; // e.g. "/farmer/bookings/"
};

export function RelatedBookings({ parent, replacements, hrefBase }: RelatedBookingsProps) {
  const t = useTranslations("Breakdown");
  const locale = useLocale();
  if (!parent && replacements.length === 0) {
    return null;
  }

  /**
   * The values for one sentence. t.rich fills {code} with the booking code and wraps the
   * <link>…</link> part of the sentence with what `link` returns: a real link, or bold text.
   */
  function sentenceValues(booking: RelatedBooking) {
    return {
      code: localizeDigits(booking.code, locale),
      link: (chunks: React.ReactNode) =>
        hrefBase ? (
          <Link href={`${hrefBase}${booking.id}`} className="font-semibold text-primary underline underline-offset-4">
            {chunks}
          </Link>
        ) : (
          <span className="font-semibold">{chunks}</span>
        ),
    };
  }

  return (
    <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
      <ArrowRightLeft className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        {parent && <p>{t.rich("replacesNote", sentenceValues(parent))}</p>}
        {replacements.map((replacement) => (
          <p key={replacement.id}>{t.rich("continuedNote", sentenceValues(replacement))}</p>
        ))}
      </div>
    </div>
  );
}
