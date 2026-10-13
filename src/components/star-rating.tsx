// Five stars, filled up to the rating (e.g. 4 of 5). Screen readers hear "4 out of 5 stars".
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function StarRating({ rating, className }: { rating: number; className?: string }) {
  const t = useTranslations("Reviews");
  const filled = Math.round(rating); // 4.4 -> 4 stars, 4.5 -> 5 stars

  return (
    <span className={cn("inline-flex gap-0.5", className)} role="img" aria-label={t("starsLabel", { rating })}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn("size-4", star <= filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
          aria-hidden
        />
      ))}
    </span>
  );
}
