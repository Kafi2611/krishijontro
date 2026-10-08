/**
 * Machine rules — small yes/no decisions about machines.
 *
 * They are pure functions (no database), so they are easy to test and can be
 * shared by the machine service, the pages and (later) the farmer search.
 */
import type { ApprovalStatus, MachineStatus } from "@/generated/prisma/enums";

/** The machine details that the admin checked when approving it. */
type ApprovedDetails = {
  machineTypeId: string;
  brand: string;
  model: string;
  registrationNo: string | null;
};

/**
 * Decides if an edited machine must be checked by the admin again (back to PENDING).
 * - A REJECTED machine goes back to PENDING after any edit (the provider fixed it).
 * - An approved machine goes back to PENDING only if the provider changed what the
 *   admin checked: type, brand, model or registration number.
 * - Changing rate, photos, place or description keeps the approval.
 */
export function needsNewApproval(
  current: ApprovedDetails & { approvalStatus: ApprovalStatus },
  edited: ApprovedDetails,
): boolean {
  if (current.approvalStatus === "REJECTED") {
    return true;
  }
  return (
    current.machineTypeId !== edited.machineTypeId ||
    current.brand !== edited.brand ||
    current.model !== edited.model ||
    current.registrationNo !== edited.registrationNo
  );
}

/**
 * True if the provider may switch the machine between ACTIVE and INACTIVE.
 * A machine UNDER_MAINTENANCE waits for the technician (Phase 6), not the provider.
 */
export function canToggleActive(status: MachineStatus): boolean {
  return status !== "UNDER_MAINTENANCE";
}

/**
 * True if farmers may see and book this machine:
 * the admin approved both the machine and its provider, and it is ACTIVE.
 * (Phase 3 search uses this rule; Phase 4 also checks free time and service hours.)
 */
export function isMachineListed(machine: {
  approvalStatus: ApprovalStatus;
  status: MachineStatus;
  providerApprovalStatus: ApprovalStatus;
}): boolean {
  return (
    machine.approvalStatus === "APPROVED" &&
    machine.providerApprovalStatus === "APPROVED" &&
    machine.status === "ACTIVE"
  );
}
