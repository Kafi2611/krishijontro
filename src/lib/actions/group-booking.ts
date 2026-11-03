"use server";
// Server actions for the cooperative leader's group booking. Each one checks ON THE SERVER that
// the user is a COOP_LEADER and checks the form again with the same Zod rules as the browser.
//   findGroupMachinesAction  — only READS: the machines free for the whole group, with prices.
//     It is an action (not a page address like the farmer's search) because the search needs
//     the whole form, with many members' plots, which does not fit well in an address.
//   createGroupBookingAction — saves the group booking with one booking per member.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  createGroupBooking,
  findGroupMachines,
  type CreateGroupResult,
  type GroupSearchResult,
} from "@/lib/services/group-booking";
import { groupBookingSchema, type GroupBookingInput } from "@/lib/validators/group-booking";

/** The machines that can do the whole group, each with every plot's price. */
export async function findGroupMachinesAction(values: GroupBookingInput): Promise<GroupSearchResult> {
  const leader = await requireRole("COOP_LEADER");
  const parsed = groupBookingSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  return findGroupMachines(leader.id, parsed.data);
}

/** "Book for all": one group booking, one booking per member, on the chosen machine. */
export async function createGroupBookingAction(values: GroupBookingInput): Promise<CreateGroupResult> {
  const leader = await requireRole("COOP_LEADER");
  const parsed = groupBookingSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  const result = await createGroupBooking(leader, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout"); // the machine is now busy; the lists change
  }
  return result;
}
