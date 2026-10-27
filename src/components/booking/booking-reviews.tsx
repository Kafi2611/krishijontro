// The farmer's review of a booking, as everyone involved sees it: the machine's stars and the
// operator's stars, each with the farmer's comment. Used on the farmer's, the provider's and
// the operator's booking pages once the booking is reviewed.
import { useTranslations } from "next-intl";
import { StarRating } from "@/components/star-rating";
import type { ReviewTarget } from "@/generated/prisma/enums";

type BookingReviewsProps = {
  reviews: { id: string; target: ReviewTarget; rating: number; comment: string | null }[];
};

export function BookingReviews({ reviews }: BookingReviewsProps) {
  const t = useTranslations("Reviews");
  return (
    <ul className="space-y-4">
      {reviews.map((review) => (
        <li key={review.id} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{review.target === "MACHINE" ? t("machine") : t("operator")}</span>
            <StarRating rating={review.rating} />
          </div>
          {review.comment && <p className="text-muted-foreground">{review.comment}</p>}
        </li>
      ))}
    </ul>
  );
}
