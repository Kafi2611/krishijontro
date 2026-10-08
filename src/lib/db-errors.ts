// Helpers to recognise database errors we expect and want to show nicely.
import { Prisma } from "@/generated/prisma/client";

/**
 * True if Prisma failed because a value that must be unique already exists
 * (Prisma error code P2002). Example: two machines with the same registration number.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
