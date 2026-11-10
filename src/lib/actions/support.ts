"use server";
// Server actions for support tickets. The user's actions check ON THE SERVER that someone is
// logged in and only touch THEIR OWN tickets; the admin's actions check the ADMIN role.
// Every form is checked again with the same Zod rules as the browser.
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import {
  addAdminReply,
  addUserReply,
  closeTicketByAdmin,
  closeUserTicket,
  createTicket,
} from "@/lib/services/support";
import { areIds } from "@/lib/validators/ids";
import { newTicketSchema, replySchema, type NewTicketInput, type ReplyInput } from "@/lib/validators/support";
import type { ActionResult, ValidationKey } from "@/lib/validators/types";

/** After a successful change, every page is drawn again (lists, the thread, the bell). */
function refreshPagesIfDone(result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

// ─────────────────────────── The user ───────────────────────────

/** Opens a new ticket. Returns its id, so the form can open the ticket's page. */
export async function createTicketAction(
  values: NewTicketInput,
): Promise<{ ok: true; ticketId: string } | { ok: false; error: ValidationKey }> {
  const user = await requireUser();
  const parsed = newTicketSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }
  const result = await createTicket(user, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** The user writes again in their own ticket. */
export async function replyTicketAction(ticketId: string, values: ReplyInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!areIds(ticketId)) {
    return { ok: false, error: "notFound" };
  }
  const parsed = replySchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "messageRequired" };
  }
  return refreshPagesIfDone(await addUserReply(ticketId, user, parsed.data.body));
}

/** The user closes their own ticket. */
export async function closeTicketAction(ticketId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!areIds(ticketId)) {
    return { ok: false, error: "notFound" };
  }
  return refreshPagesIfDone(await closeUserTicket(ticketId, user.id));
}

// ─────────────────────────── The admin ───────────────────────────

/** An admin answers a ticket. */
export async function adminReplyTicketAction(ticketId: string, values: ReplyInput): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  if (!areIds(ticketId)) {
    return { ok: false, error: "notFound" };
  }
  const parsed = replySchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "messageRequired" };
  }
  return refreshPagesIfDone(await addAdminReply(ticketId, admin.id, parsed.data.body));
}

/** An admin closes a ticket. */
export async function adminCloseTicketAction(ticketId: string): Promise<ActionResult> {
  await requireRole("ADMIN");
  if (!areIds(ticketId)) {
    return { ok: false, error: "notFound" };
  }
  return refreshPagesIfDone(await closeTicketByAdmin(ticketId));
}
