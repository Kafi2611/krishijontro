/**
 * Approval service — the admin checks new providers, machines and operators.
 *
 * Each item waits as PENDING. The admin either approves it (APPROVED) or rejects it
 * with a reason (REJECTED). Every decision does three things together, in ONE
 * database transaction (all three are saved, or none):
 *   1. changes the approval status
 *   2. writes an AuditLog row (who decided what, and when)
 *   3. sends the owner a simulated SMS with the result (and the reason, if rejected)
 * Only PENDING items can be decided, so two admins cannot decide the same item twice.
 */
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notification";
import type { ApprovalDecision } from "@/lib/validators/approval";
import type { ActionResult } from "@/lib/validators/types";

// ─────────────────────────── Lists for the approvals page ───────────────────────────

/** How many items wait in each list (the numbers on the tabs and the admin dashboard). */
export async function countPendingApprovals() {
  const [providers, machines, operators] = await Promise.all([
    db.providerProfile.count({ where: { approvalStatus: "PENDING" } }),
    db.machine.count({ where: { approvalStatus: "PENDING" } }),
    db.operatorProfile.count({ where: { approvalStatus: "PENDING" } }),
  ]);
  return { providers, machines, operators };
}

/** Providers waiting for approval, oldest first, with their user account and upazila. */
export async function listPendingProviders() {
  return db.providerProfile.findMany({
    where: { approvalStatus: "PENDING" },
    include: {
      user: {
        select: { name: true, phone: true, createdAt: true, _count: { select: { machines: true } } },
      },
      location: { include: { parent: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Machines waiting for approval, oldest first, with type, place, photos and owner. */
export async function listPendingMachines() {
  return db.machine.findMany({
    where: { approvalStatus: "PENDING" },
    include: {
      machineType: true,
      location: { include: { parent: true } },
      images: { orderBy: { sortOrder: "asc" } },
      provider: {
        select: {
          name: true,
          phone: true,
          providerProfile: { select: { businessName: true, approvalStatus: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Operators waiting for approval, oldest first, with their account and employer. */
export async function listPendingOperators() {
  return db.operatorProfile.findMany({
    where: { approvalStatus: "PENDING" },
    include: {
      user: { select: { name: true, phone: true, createdAt: true } },
      provider: {
        select: { name: true, providerProfile: { select: { businessName: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

// ─────────────────────────── Decisions ───────────────────────────

/** "APPROVED" or "REJECTED", from the admin's choice. */
function newStatus(decision: ApprovalDecision) {
  return decision.approve ? ("APPROVED" as const) : ("REJECTED" as const);
}

/** Approves or rejects a provider account. Tells the provider by SMS. */
export async function decideProvider(
  providerUserId: string,
  adminId: string,
  decision: ApprovalDecision,
): Promise<ActionResult> {
  const profile = await db.providerProfile.findUnique({
    where: { userId: providerUserId },
    include: { user: { select: { name: true } } },
  });
  if (!profile) {
    return { ok: false, error: "notFound" };
  }
  if (profile.approvalStatus !== "PENDING") {
    return { ok: false, error: "alreadyDecided" };
  }

  await db.$transaction(async (tx) => {
    await tx.providerProfile.update({
      where: { userId: providerUserId },
      data: {
        approvalStatus: newStatus(decision),
        approvedAt: decision.approve ? new Date() : null,
      },
    });
    await writeAuditLog(
      {
        actorId: adminId,
        action: decision.approve ? "PROVIDER_APPROVED" : "PROVIDER_REJECTED",
        entityType: "ProviderProfile",
        entityId: profile.id,
        details: decision.approve
          ? `Approved provider ${profile.user.name}`
          : `Rejected provider ${profile.user.name}: ${decision.reason}`,
      },
      tx,
    );
    await createNotification(
      decision.approve
        ? {
            userId: providerUserId,
            channel: "SMS",
            title: "Your account is approved",
            titleBn: "আপনার অ্যাকাউন্ট অনুমোদিত হয়েছে",
            body: "Your provider account is approved. Farmers can now book your approved machines.",
            bodyBn: "আপনার যন্ত্র মালিক অ্যাকাউন্ট অনুমোদিত হয়েছে। এখন কৃষকরা আপনার অনুমোদিত যন্ত্র বুক করতে পারবেন।",
            link: "/provider",
          }
        : {
            userId: providerUserId,
            channel: "SMS",
            title: "Your account was not approved",
            titleBn: "আপনার অ্যাকাউন্ট অনুমোদন পায়নি",
            body: `Reason: ${decision.reason}. Fix your business details and save them to ask again.`,
            bodyBn: `কারণ: ${decision.reason}। ব্যবসার তথ্য ঠিক করে সংরক্ষণ করলে আবার যাচাই হবে।`,
            link: "/provider/business",
          },
      tx,
    );
  });
  return { ok: true };
}

/** Approves or rejects a machine. Tells its provider by SMS. */
export async function decideMachine(
  machineId: string,
  adminId: string,
  decision: ApprovalDecision,
): Promise<ActionResult> {
  const machine = await db.machine.findUnique({ where: { id: machineId } });
  if (!machine) {
    return { ok: false, error: "notFound" };
  }
  if (machine.approvalStatus !== "PENDING") {
    return { ok: false, error: "alreadyDecided" };
  }
  const machineName = `${machine.brand} ${machine.model}`;

  await db.$transaction(async (tx) => {
    await tx.machine.update({
      where: { id: machineId },
      data: {
        approvalStatus: newStatus(decision),
        rejectionReason: decision.approve ? null : decision.reason,
      },
    });
    await writeAuditLog(
      {
        actorId: adminId,
        action: decision.approve ? "MACHINE_APPROVED" : "MACHINE_REJECTED",
        entityType: "Machine",
        entityId: machineId,
        details: decision.approve
          ? `Approved machine ${machineName}`
          : `Rejected machine ${machineName}: ${decision.reason}`,
      },
      tx,
    );
    await createNotification(
      decision.approve
        ? {
            userId: machine.providerId,
            channel: "SMS",
            title: "Machine approved",
            titleBn: "যন্ত্র অনুমোদিত হয়েছে",
            body: `${machineName} is approved. Farmers can now find and book it.`,
            bodyBn: `${machineName} অনুমোদিত হয়েছে। এখন কৃষকরা এটি খুঁজে বুক করতে পারবেন।`,
            link: `/provider/machines/${machineId}`,
          }
        : {
            userId: machine.providerId,
            channel: "SMS",
            title: "Machine not approved",
            titleBn: "যন্ত্র অনুমোদন পায়নি",
            body: `${machineName} was not approved. Reason: ${decision.reason}`,
            bodyBn: `${machineName} অনুমোদন পায়নি। কারণ: ${decision.reason}`,
            link: `/provider/machines/${machineId}`,
          },
      tx,
    );
  });
  return { ok: true };
}

/** Approves or rejects an operator account. Tells both the operator and their provider. */
export async function decideOperator(
  operatorUserId: string,
  adminId: string,
  decision: ApprovalDecision,
): Promise<ActionResult> {
  const profile = await db.operatorProfile.findUnique({
    where: { userId: operatorUserId },
    include: { user: { select: { name: true } } },
  });
  if (!profile) {
    return { ok: false, error: "notFound" };
  }
  if (profile.approvalStatus !== "PENDING") {
    return { ok: false, error: "alreadyDecided" };
  }
  const operatorName = profile.user.name;

  await db.$transaction(async (tx) => {
    await tx.operatorProfile.update({
      where: { userId: operatorUserId },
      data: { approvalStatus: newStatus(decision) },
    });
    await writeAuditLog(
      {
        actorId: adminId,
        action: decision.approve ? "OPERATOR_APPROVED" : "OPERATOR_REJECTED",
        entityType: "OperatorProfile",
        entityId: profile.id,
        details: decision.approve
          ? `Approved operator ${operatorName}`
          : `Rejected operator ${operatorName}: ${decision.reason}`,
      },
      tx,
    );
    // The provider (employer) is told in both cases.
    await createNotification(
      decision.approve
        ? {
            userId: profile.providerId,
            title: "Operator approved",
            titleBn: "চালক অনুমোদিত হয়েছেন",
            body: `${operatorName} is approved. You can now send them to jobs.`,
            bodyBn: `${operatorName} অনুমোদিত হয়েছেন। এখন তাঁকে কাজে পাঠাতে পারবেন।`,
            link: "/provider/operators",
          }
        : {
            userId: profile.providerId,
            title: "Operator not approved",
            titleBn: "চালক অনুমোদন পাননি",
            body: `${operatorName} was not approved. Reason: ${decision.reason}`,
            bodyBn: `${operatorName} অনুমোদন পাননি। কারণ: ${decision.reason}`,
            link: "/provider/operators",
          },
      tx,
    );
    // The operator gets an SMS only when approved (they can start working).
    if (decision.approve) {
      await createNotification(
        {
          userId: operatorUserId,
          channel: "SMS",
          title: "You are approved",
          titleBn: "আপনি অনুমোদিত হয়েছেন",
          body: "Your operator account is approved. You will see your jobs here.",
          bodyBn: "আপনার চালক অ্যাকাউন্ট অনুমোদিত হয়েছে। আপনার কাজগুলো এখানে দেখতে পাবেন।",
          link: "/operator",
        },
        tx,
      );
    }
  });
  return { ok: true };
}
