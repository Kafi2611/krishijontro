/**
 * User service — creating accounts and reading a user's profile.
 *
 * - registerUser: makes a new FARMER or PROVIDER account (self sign-up),
 *   with an empty profile row for that role.
 * - getUserWithProfile: reads one user together with their role profile,
 *   for the profile page.
 */
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { RegisterInput } from "@/lib/validators/auth";

export type RegisterResult = { ok: true; userId: string } | { ok: false; error: "phoneTaken" };

/**
 * Creates a new user account from the register form.
 * Takes already-validated form data. Returns the new user's id,
 * or { ok: false, error: "phoneTaken" } if the phone number is already used.
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const existingUser = await db.user.findUnique({ where: { phone: input.phone } });
  if (existingUser) {
    return { ok: false, error: "phoneTaken" };
  }

  const passwordHash = await hashPassword(input.password);
  const isFarmer = input.role === "FARMER";

  try {
    // One query creates the user AND the matching profile row.
    const user = await db.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        passwordHash,
        role: input.role,
        farmerProfile: isFarmer ? { create: {} } : undefined,
        providerProfile: isFarmer ? undefined : { create: { providerType: input.providerType } },
      },
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    // P2002 = "unique value already exists". This can happen if two people
    // register the same phone number at the very same moment.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "phoneTaken" };
    }
    throw error;
  }
}

/**
 * Reads one user with every possible profile (only the one matching the role is filled).
 * Never returns the password hash. Returns null if the user does not exist.
 */
export async function getUserWithProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      farmerProfile: { include: { location: true } },
      providerProfile: { include: { location: true } },
      operatorProfile: { include: { provider: { select: { name: true } } } },
      technicianProfile: { include: { location: true } },
      officerProfile: { include: { upazila: true } },
    },
  });
}
