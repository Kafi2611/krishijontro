"use server";
// Server actions for bookings. Each one first checks ON THE SERVER that the user has the
// right role, checks the form again with the same Zod rules as the browser, then calls
// the booking service with the user's own id (so nobody can act for someone else).
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  acceptBooking,
  assignOperator,
  createBooking,
  finishWork,
  markArrived,
  rejectBooking,
  startTrip,
  startWork,
  type CreateBookingResult,
} from "@/lib/services/booking";
import {
  assignOperatorSchema,
  bookingSchema,
  finishWorkSchema,
  rejectBookingSchema,
  startWorkSchema,
  type AssignOperatorInput,
  type BookingInput,
  type FinishWorkInput,
  type RejectBookingInput,
  type StartWorkInput,
} from "@/lib/validators/booking";
import type { ActionResult } from "@/lib/validators/types";

/** After a successful step, every page is drawn again with the new status. */
function refreshPagesIfDone(result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

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

// ─────────────────────────── Provider ───────────────────────────

/** The provider accepts a request: the farmer gets the start and finish codes. */
export async function acceptBookingAction(bookingId: string): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  return refreshPagesIfDone(await acceptBooking(bookingId, provider.id));
}

/** The provider rejects a request with a reason (sent to the farmer). */
export async function rejectBookingAction(bookingId: string, values: RejectBookingInput): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  const parsed = rejectBookingSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "reasonRequired" };
  }
  return refreshPagesIfDone(await rejectBooking(bookingId, provider.id, parsed.data.reason));
}

/** The provider sends one of their operators to an accepted booking. */
export async function assignOperatorAction(bookingId: string, values: AssignOperatorInput): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  const parsed = assignOperatorSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "chooseOperator" };
  }
  return refreshPagesIfDone(await assignOperator(bookingId, provider.id, parsed.data.operatorId));
}

// ─────────────────────────── Operator ───────────────────────────

/** "I am on the way". */
export async function startTripAction(bookingId: string): Promise<ActionResult> {
  const operator = await requireRole("OPERATOR");
  return refreshPagesIfDone(await startTrip(bookingId, operator.id));
}

/** "I have arrived". */
export async function markArrivedAction(bookingId: string): Promise<ActionResult> {
  const operator = await requireRole("OPERATOR");
  return refreshPagesIfDone(await markArrived(bookingId, operator.id));
}

/** "Start the work", with the farmer's start code. */
export async function startWorkAction(bookingId: string, values: StartWorkInput): Promise<ActionResult> {
  const operator = await requireRole("OPERATOR");
  const parsed = startWorkSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "otpInvalid" };
  }
  return refreshPagesIfDone(await startWork(bookingId, operator.id, parsed.data.otp));
}

/** "Finish the work", with the real amount of work and the farmer's finish code. */
export async function finishWorkAction(bookingId: string, values: FinishWorkInput): Promise<ActionResult> {
  const operator = await requireRole("OPERATOR");
  const parsed = finishWorkSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return refreshPagesIfDone(await finishWork(bookingId, operator.id, parsed.data));
}
