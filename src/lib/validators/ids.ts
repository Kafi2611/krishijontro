// Checks for the ids that pages send to server actions, e.g. the id of the booking to accept.
// An id comes from the browser like any form value, so the server checks it too: a changed page
// could send anything (a number, a very long text). An id that is not in the right shape is
// simply "not found", instead of an error deep inside the database code.
import { z } from "zod";

/**
 * A database id. Prisma makes them with cuid(): lowercase letters and digits,
 * e.g. "cmwahd7z30034solls1riliv1".
 */
export const idSchema = z.string().regex(/^[a-z0-9]{1,40}$/);

/**
 * Our own id of a payment try, e.g. "PAY-KJ-2026-000023-7F3A9C" (makeTransactionId in
 * lib/services/payment-rules.ts).
 */
export const transactionIdSchema = z.string().regex(/^PAY-[A-Z0-9-]{1,40}$/);

/**
 * True if every value is a database id in the right shape.
 * Example: areIds("cmwahd7z30034solls1riliv1") -> true; areIds("abc", 42) -> false
 */
export function areIds(...values: unknown[]): boolean {
  return values.every((value) => idSchema.safeParse(value).success);
}
