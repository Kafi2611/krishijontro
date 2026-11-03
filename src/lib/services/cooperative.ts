/**
 * Cooperative service — a cooperative leader's group of farmers in one village.
 *
 * - Each leader (role COOP_LEADER) runs ONE cooperative: its name, upazila, village and
 *   registration number (saveCooperative makes it the first time, then changes it).
 * - The leader adds member farmers by their mobile number (they must already have a FARMER
 *   account) and can remove them. The farmer gets a message each time.
 * - Members are who a group booking can be made for (group-booking.ts).
 * Every function takes the leader's own id, so a leader only ever changes THEIR cooperative.
 */
import { db } from "@/lib/db";
import { isUniqueConstraintError } from "@/lib/db-errors";
import { memberAddedMessage, memberRemovedMessage } from "@/lib/services/cooperative-messages";
import { isUpazila } from "@/lib/services/location";
import { createNotification } from "@/lib/services/notification";
import type { CooperativeInput } from "@/lib/validators/cooperative";
import type { ActionResult } from "@/lib/validators/types";

/** The leader's cooperative with its upazila and how many members it has, or null if none yet. */
export async function getLeaderCooperative(leaderId: string) {
  return db.cooperative.findFirst({
    where: { leaderId },
    include: {
      location: { select: { id: true, name: true, nameBn: true, lat: true, lng: true } },
      _count: { select: { members: true, groupBookings: true } },
    },
  });
}

/**
 * Makes the leader's cooperative, or changes its details if it already exists.
 * Returns ok, or "chooseUpazila" if the upazila is not a real upazila.
 */
export async function saveCooperative(leaderId: string, input: CooperativeInput): Promise<ActionResult> {
  if (!(await isUpazila(input.upazilaId))) {
    return { ok: false, error: "chooseUpazila" };
  }
  const data = {
    name: input.name,
    locationId: input.upazilaId,
    village: input.village,
    registrationNo: input.registrationNo === "" ? null : input.registrationNo,
  };

  const existing = await db.cooperative.findFirst({ where: { leaderId }, select: { id: true } });
  if (existing) {
    await db.cooperative.update({ where: { id: existing.id }, data });
  } else {
    await db.cooperative.create({ data: { ...data, leaderId } });
  }
  return { ok: true };
}

/**
 * The members of the leader's cooperative (A to Z), with what a group booking needs:
 * their land and village (from the farmer's profile) and whether an officer verified them.
 */
export async function listMembers(leaderId: string) {
  const members = await db.cooperativeMember.findMany({
    where: { cooperative: { leaderId } },
    include: {
      farmer: {
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
          farmerProfile: { select: { landDecimal: true, village: true, verificationStatus: true } },
        },
      },
    },
    orderBy: { farmer: { name: "asc" } },
  });
  return members;
}

/**
 * Adds a farmer to the leader's cooperative by their mobile number.
 * Returns ok, or an error key: "createCooperativeFirst", "farmerNotFound" (no FARMER account
 * with that number) or "alreadyMember".
 */
export async function addMember(leader: { id: string; name: string }, phone: string): Promise<ActionResult> {
  const cooperative = await db.cooperative.findFirst({ where: { leaderId: leader.id } });
  if (!cooperative) {
    return { ok: false, error: "createCooperativeFirst" };
  }
  const farmer = await db.user.findFirst({ where: { phone, role: "FARMER" }, select: { id: true } });
  if (!farmer) {
    return { ok: false, error: "farmerNotFound" };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.cooperativeMember.create({ data: { cooperativeId: cooperative.id, farmerId: farmer.id } });
      await createNotification(
        { userId: farmer.id, channel: "SMS", ...memberAddedMessage(cooperative.name, leader.name) },
        tx,
      );
    });
    return { ok: true };
  } catch (error) {
    // The same farmer twice: the table allows each farmer only once per cooperative (@@unique).
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "alreadyMember" };
    }
    throw error;
  }
}

/**
 * Removes a member from the leader's OWN cooperative. Their bookings stay as they are.
 * Returns ok, or "notFound" if the member is not in this leader's cooperative.
 */
export async function removeMember(leaderId: string, memberId: string): Promise<ActionResult> {
  return db.$transaction(async (tx) => {
    const member = await tx.cooperativeMember.findFirst({
      where: { id: memberId, cooperative: { leaderId } },
      include: { cooperative: { select: { name: true } } },
    });
    if (!member) {
      return { ok: false, error: "notFound" } as const;
    }
    await tx.cooperativeMember.delete({ where: { id: member.id } });
    await createNotification(
      { userId: member.farmerId, channel: "SMS", ...memberRemovedMessage(member.cooperative.name) },
      tx,
    );
    return { ok: true } as const;
  });
}
