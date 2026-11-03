/**
 * Staff service — accounts the admin makes for people who cannot sign up themselves:
 * cooperative leaders, technicians, agriculture officers, the government authority and admins.
 *
 * createStaffUser() saves, in ONE transaction:
 *   - the User with its role (and the profile that role needs: an officer's upazila,
 *     a technician's skills and area)
 *   - an audit log row ("STAFF_CREATED"), because making an account is an important admin action
 *   - a welcome message (simulated SMS). The password is never sent in a message: the admin
 *     tells it to the person, like a provider does for an operator.
 */
import { db } from "@/lib/db";
import { isUniqueConstraintError } from "@/lib/db-errors";
import { hashPassword } from "@/lib/password";
import { staffWelcomeMessage } from "@/lib/services/account-messages";
import { writeAuditLog } from "@/lib/services/audit";
import { isUpazila } from "@/lib/services/location";
import { createNotification } from "@/lib/services/notification";
import type { StaffInput } from "@/lib/validators/staff";
import type { ActionResult } from "@/lib/validators/types";

/** An empty text box is saved as "no value" (null). */
function emptyToNull(text: string): string | null {
  return text === "" ? null : text;
}

/**
 * The profile row the new account needs, as Prisma's "create inside create" data:
 * an officer gets an OfficerProfile with their upazila, a technician a TechnicianProfile.
 * The other staff roles have no profile table.
 */
function profileFor(input: StaffInput) {
  if (input.role === "OFFICER") {
    return { officerProfile: { create: { upazilaId: input.upazilaId, designation: emptyToNull(input.designation) } } };
  }
  if (input.role === "TECHNICIAN") {
    return { technicianProfile: { create: { locationId: emptyToNull(input.upazilaId), skills: emptyToNull(input.skills) } } };
  }
  return {};
}

/**
 * The admin makes a staff account (already checked by staffSchema).
 * Returns ok, or an error key: "phoneTaken", or "chooseUpazila" if the upazila does not exist.
 */
export async function createStaffUser(adminId: string, input: StaffInput): Promise<ActionResult> {
  const existingUser = await db.user.findUnique({ where: { phone: input.phone } });
  if (existingUser) {
    return { ok: false, error: "phoneTaken" };
  }
  // The upazila must be a real upazila row (not a district, not a made-up id).
  if (input.upazilaId !== "" && !(await isUpazila(input.upazilaId))) {
    return { ok: false, error: "chooseUpazila" };
  }

  const passwordHash = await hashPassword(input.password);
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: input.name, phone: input.phone, passwordHash, role: input.role, ...profileFor(input) },
      });
      await writeAuditLog(
        {
          actorId: adminId,
          action: "STAFF_CREATED",
          entityType: "User",
          entityId: user.id,
          details: `Made a ${input.role} account for ${input.name} (${input.phone})`,
        },
        tx,
      );
      await createNotification({ userId: user.id, channel: "SMS", ...staffWelcomeMessage(input.role) }, tx);
    });
    return { ok: true };
  } catch (error) {
    // Two admins saving the same number at the same moment
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "phoneTaken" };
    }
    throw error;
  }
}
