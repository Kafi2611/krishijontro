"use server";
// Server action for reviews: the farmer rates the machine and the operator of a paid job.
// It first checks ON THE SERVER that the user is a farmer, checks the form again with the same
// Zod rules as the browser, then calls the service with the farmer's own id.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { submitReviews } from "@/lib/services/review";
import { reviewSchema, type ReviewInput } from "@/lib/validators/review";
import type { ActionResult } from "@/lib/validators/types";

/** "Send review": the stars (and comments) for the machine and the operator. */
export async function submitReviewAction(bookingId: string, values: ReviewInput): Promise<ActionResult> {
  const farmer = await requireRole("FARMER");
  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "ratingRequired" };
  }
  const result = await submitReviews(bookingId, farmer.id, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout"); // the booking is now "Reviewed", and the ratings changed
  }
  return result;
}
