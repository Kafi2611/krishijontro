"use server";
// Server actions for bookings. Each one first checks ON THE SERVER that the user has the
// right role, checks the form again with the same Zod rules as the browser, then calls
// the booking service with the user's own id (so nobody can act for someone else).
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createBooking, type CreateBookingResult } from "@/lib/services/booking";
import { bookingSchema, type BookingInput } from "@/lib/validators/booking";

/** The farmer's "Book now". Returns the new booking's id, or an error key. */
export async function createBookingAction(values: BookingInput): Promise<CreateBookingResult> {
  const farmer = await requireRole("FARMER");
  // Never trust the browser: check the form again with the same Zod rules.
  const parsed = bookingSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await createBooking(farmer, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout"); // the machine is now busy at that time; the lists change
  }
  return result;
}
