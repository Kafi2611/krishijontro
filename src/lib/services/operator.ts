/**
 * Operator service — the drivers who work for a provider.
 *
 * - A provider adds an operator: this creates a User (role OPERATOR) and an
 *   OperatorProfile that points to the provider.
 * - A new operator is PENDING until the admin approves them. Only approved
 *   operators can be sent to jobs (Phase 4).
 * - The operator gets a welcome SMS (simulated). We never send the password in a
 *   message; the provider tells it to the operator in person.
 */
import { db } from "@/lib/db";
import { isUniqueConstraintError } from "@/lib/db-errors";
import { hashPassword } from "@/lib/password";
import { createNotification, notifyAllAdmins } from "@/lib/services/notification";
import type { OperatorInput } from "@/lib/validators/operator";
import type { ActionResult } from "@/lib/validators/types";

/** All operators of one provider, newest first, with their profile. Never the password hash. */
export async function listProviderOperators(providerId: string) {
  return db.user.findMany({
    where: { role: "OPERATOR", operatorProfile: { providerId } },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
      operatorProfile: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Creates an operator account for a provider.
 * Returns ok, or "phoneTaken" if that mobile number already has an account.
 */
export async function createOperator(
  providerId: string,
  providerName: string,
  input: OperatorInput,
): Promise<ActionResult> {
  const existingUser = await db.user.findUnique({ where: { phone: input.phone } });
  if (existingUser) {
    return { ok: false, error: "phoneTaken" };
  }

  const passwordHash = await hashPassword(input.password);
  try {
    // Transaction: the account, its profile and the messages are saved together.
    await db.$transaction(async (tx) => {
      const operator = await tx.user.create({
        data: {
          name: input.name,
          phone: input.phone,
          passwordHash,
          role: "OPERATOR",
          operatorProfile: {
            create: {
              providerId,
              licenseNo: input.licenseNo === "" ? null : input.licenseNo,
              experienceYears: input.experienceYears,
              approvalStatus: "PENDING",
            },
          },
        },
      });
      await createNotification(
        {
          userId: operator.id,
          channel: "SMS",
          title: "Welcome to KrishiJontro",
          titleBn: "কৃষিযন্ত্রে স্বাগতম",
          body: `${providerName} added you as an operator. Log in with this mobile number.`,
          bodyBn: `${providerName} আপনাকে চালক হিসেবে যোগ করেছেন। এই মোবাইল নম্বর দিয়ে লগইন করুন।`,
        },
        tx,
      );
      await notifyAllAdmins(
        {
          title: "Operator waiting for approval",
          titleBn: "চালক অনুমোদনের অপেক্ষায়",
          body: `${providerName} added the operator ${input.name}.`,
          bodyBn: `${providerName} চালক ${input.name}-কে যোগ করেছেন।`,
          link: "/admin/approvals?tab=operators",
        },
        tx,
      );
    });
    return { ok: true };
  } catch (error) {
    // Two people saving the same number at the same moment
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "phoneTaken" };
    }
    throw error;
  }
}
