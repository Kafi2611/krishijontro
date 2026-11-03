/**
 * User service — creating accounts, reading a user's profile, and the admin's Users page.
 *
 * - registerUser: makes a new FARMER or PROVIDER account (self sign-up),
 *   with an empty profile row for that role. Admins are told about new providers.
 * - getUserWithProfile: reads one user together with their role profile,
 *   for the profile page.
 * - listUsersForAdmin / countUsersByRole: the admin's list of every account, with filters.
 * - changeUserStatus: the admin suspends or activates an account (audit log + a message).
 * (Staff accounts that the admin makes are in staff.ts.)
 */
import { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { accountActivatedMessage, accountSuspendedMessage } from "@/lib/services/account-messages";
import { writeAuditLog } from "@/lib/services/audit";
import { createNotification, notifyAllAdmins } from "@/lib/services/notification";
import type { RegisterInput } from "@/lib/validators/auth";
import type { ActionResult } from "@/lib/validators/types";
import type { UserStatusInput } from "@/lib/validators/user";

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

// ─────────────────────────── The admin's Users page ───────────────────────────

/** How many users one page of the admin's list shows. */
export const USERS_PER_PAGE = 30;

/** The admin's filters: one role (or all), words to find in the name or mobile number, the page number. */
export type UserListFilter = {
  role: Role | null;
  query: string;
  page: number; // 1 = the first page
};

/**
 * One page of users for the admin, newest first, with the facts each card shows
 * (business name, upazila, employer...). Never the password hash.
 * Returns the users, how many match in total, and how many pages that makes.
 */
export async function listUsersForAdmin(filter: UserListFilter) {
  const where: Prisma.UserWhereInput = {};
  if (filter.role) {
    where.role = filter.role;
  }
  if (filter.query !== "") {
    // "insensitive": "karim" also finds "Karim".
    where.OR = [
      { name: { contains: filter.query, mode: "insensitive" } },
      { phone: { contains: filter.query } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        farmerProfile: { select: { verificationStatus: true } },
        providerProfile: { select: { businessName: true, approvalStatus: true } },
        operatorProfile: { select: { provider: { select: { name: true } } } },
        officerProfile: { select: { upazila: { select: { name: true, nameBn: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * USERS_PER_PAGE,
      take: USERS_PER_PAGE,
    }),
    db.user.count({ where }),
  ]);
  return { users, total, pageCount: Math.max(1, Math.ceil(total / USERS_PER_PAGE)) };
}

/** How many accounts each role has, e.g. { FARMER: 11, ADMIN: 1, ... }. For the filter buttons. */
export async function countUsersByRole(): Promise<Partial<Record<Role, number>>> {
  const groups = await db.user.groupBy({ by: ["role"], _count: { _all: true } });
  const counts: Partial<Record<Role, number>> = {};
  for (const group of groups) {
    counts[group.role] = group._count._all;
  }
  return counts;
}

/**
 * The admin suspends or activates an account (never their own: an admin could lock themselves out).
 * A suspended user cannot log in and is stopped at once (requireUser in lib/auth.ts reads the
 * status on every page). Their machines leave the search, and an operator cannot be sent to jobs.
 * In one transaction: the new status, an audit log row and a message (simulated SMS) to the user.
 */
export async function changeUserStatus(adminId: string, userId: string, input: UserStatusInput): Promise<ActionResult> {
  if (adminId === userId) {
    return { ok: false, error: "cannotChangeOwnAccount" };
  }

  return db.$transaction(async (tx) => {
    // Change it only if it is not already that status (two admins pressing at once: count 0).
    const { count } = await tx.user.updateMany({
      where: { id: userId, status: { not: input.status } },
      data: { status: input.status },
    });
    if (count === 0) {
      return { ok: false, error: "alreadyDecided" } as const;
    }

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, phone: true } });
    const isSuspended = input.status === "SUSPENDED";
    await writeAuditLog(
      {
        actorId: adminId,
        action: isSuspended ? "USER_SUSPENDED" : "USER_ACTIVATED",
        entityType: "User",
        entityId: userId,
        details: isSuspended ? `Suspended ${user.name} (${user.phone}): ${input.reason}` : `Activated ${user.name} (${user.phone})`,
      },
      tx,
    );
    const message = isSuspended ? accountSuspendedMessage(input.reason) : accountActivatedMessage();
    await createNotification({ userId, channel: "SMS", ...message }, tx);
    return { ok: true } as const;
  });
}
