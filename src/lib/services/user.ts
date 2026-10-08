/**
 * User service — creating accounts and reading a user's profile.
 *
 * - registerUser: makes a new FARMER or PROVIDER account (self sign-up),
 *   with an empty profile row for that role. Admins are told about new providers.
 * - getUserWithProfile: reads one user together with their role profile,
 *   for the profile page.
 */
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { notifyAllAdmins } from "@/lib/services/notification";
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
    const user = await db.$transaction(async (tx) => {
      // One query creates the user AND the matching profile row.
      const newUser = await tx.user.create({
        data: {
          name: input.name,
          phone: input.phone,
          passwordHash,
          role: input.role,
          farmerProfile: isFarmer ? { create: {} } : undefined,
          providerProfile: isFarmer ? undefined : { create: { providerType: input.providerType } },
        },
      });
      // A new provider must be checked by the admin, so every admin gets a message.
      if (!isFarmer) {
        await notifyAllAdmins(
          {
            title: "New provider registered",
            titleBn: "নতুন যন্ত্র মালিক নিবন্ধন করেছেন",
            body: `${input.name} registered as a machine provider and waits for approval.`,
            bodyBn: `${input.name} যন্ত্র মালিক হিসেবে নিবন্ধন করেছেন, অনুমোদনের অপেক্ষায় আছেন।`,
            link: "/admin/approvals?tab=providers",
          },
          tx,
        );
      }
      return newUser;
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
