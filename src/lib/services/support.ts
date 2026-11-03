/**
 * Support service — help requests ("support tickets") and their conversation.
 *
 * Any logged-in user can open a ticket: a subject, maybe one of their bookings, and a first
 * message. The admins answer in the same ticket, like a chat. The status shows whose turn it is:
 *   OPEN        — waiting for an admin (a new ticket, or the user wrote again)
 *   IN_PROGRESS — an admin answered; waiting for the user (or nothing more to do)
 *   CLOSED      — finished; nobody can write in it any more (a new ticket can be opened)
 * Every message is saved in TicketMessage. The other side gets a notification each time.
 * Safety: a user only ever reads and writes THEIR OWN tickets; only admin pages call the
 * admin functions (they read every ticket).
 */
import type { Prisma } from "@/generated/prisma/client";
import type { Role, TicketStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { createNotification, notifyAllAdmins } from "@/lib/services/notification";
import {
  adminRepliedMessage,
  newTicketMessage,
  ticketClosedMessage,
  userRepliedMessage,
} from "@/lib/services/support-messages";
import type { NewTicketInput } from "@/lib/validators/support";
import type { ActionResult } from "@/lib/validators/types";

/** The user who writes: their id, name and role. */
type Writer = { id: string; name: string; role: Role };

// ─────────────────────────── Which bookings a ticket may be about ───────────────────────────

/**
 * The where-condition for "bookings this user is part of": a farmer's own bookings, the
 * bookings of a provider's machines, an operator's jobs. Other roles have no bookings.
 */
function bookingsOfUser(user: { id: string; role: Role }): Prisma.BookingWhereInput | null {
  if (user.role === "FARMER") {
    return { farmerId: user.id };
  }
  if (user.role === "PROVIDER") {
    return { machine: { providerId: user.id } };
  }
  if (user.role === "OPERATOR") {
    return { operatorId: user.id };
  }
  return null;
}

/** The user's latest 20 bookings, to choose one on the "new ticket" form (code and machine name). */
export async function listTicketBookingChoices(user: { id: string; role: Role }) {
  const where = bookingsOfUser(user);
  if (!where) {
    return [];
  }
  const bookings = await db.booking.findMany({
    where,
    select: { id: true, code: true, machine: { select: { brand: true, model: true } } },
    orderBy: { startAt: "desc" },
    take: 20,
  });
  return bookings.map((booking) => ({ id: booking.id, label: `${booking.code} · ${booking.machine.brand} ${booking.machine.model}` }));
}

// ─────────────────────────── The user's side ───────────────────────────

/**
 * The user opens a ticket (already checked by newTicketSchema). The booking, if chosen, must be
 * one of theirs. In one transaction: the ticket, its first message, and a message to every admin.
 * Returns the new ticket's id, or an error key.
 */
export async function createTicket(
  user: Writer,
  input: NewTicketInput,
): Promise<{ ok: true; ticketId: string } | { ok: false; error: "notFound" }> {
  let bookingId: string | null = null;
  if (input.bookingId !== "") {
    const where = bookingsOfUser(user);
    const booking = where ? await db.booking.findFirst({ where: { ...where, id: input.bookingId }, select: { id: true } }) : null;
    if (!booking) {
      return { ok: false, error: "notFound" }; // not one of this user's bookings
    }
    bookingId = booking.id;
  }

  const ticket = await db.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: { userId: user.id, subject: input.subject, bookingId, status: "OPEN" },
    });
    await tx.ticketMessage.create({ data: { ticketId: created.id, senderId: user.id, body: input.message } });
    await notifyAllAdmins(newTicketMessage(created, user.name), tx);
    return created;
  });
  return { ok: true, ticketId: ticket.id };
}

/** The user's own tickets, the one with the latest activity first, with how many messages each has. */
export async function listUserTickets(userId: string) {
  return db.supportTicket.findMany({
    where: { userId },
    include: { _count: { select: { messages: true } }, booking: { select: { code: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

/** The messages of a ticket, oldest first, with the name and role of whoever wrote each one. */
const TICKET_MESSAGES = {
  include: { sender: { select: { id: true, name: true, role: true } } },
  orderBy: { createdAt: "asc" },
} satisfies Prisma.SupportTicket$messagesArgs;

/** One of the user's OWN tickets with its conversation, or null (no such ticket, or not theirs). */
export async function getUserTicket(ticketId: string, userId: string) {
  return db.supportTicket.findFirst({
    where: { id: ticketId, userId },
    include: { messages: TICKET_MESSAGES, booking: { select: { code: true } } },
  });
}

/** What a reply needs to tell the other side: the ticket's id, subject and owner. */
type RepliedTicket = { id: string; subject: string; userId: string };

/**
 * Saves one more message in a ticket, moves the ticket to `nextStatus` and tells the other side
 * (`notify`), all in ONE transaction — but only while the ticket is not CLOSED. `where` says
 * which ticket may be changed (for a user: only their own).
 * Returns { ok: true }, or "ticketClosed" if it is closed or not found (then nothing was saved).
 */
async function saveReply(
  where: Prisma.SupportTicketWhereInput,
  senderId: string,
  body: string,
  nextStatus: TicketStatus,
  notify: (tx: Prisma.TransactionClient, ticket: RepliedTicket) => Promise<void>,
): Promise<ActionResult> {
  return db.$transaction(async (tx) => {
    // "status not CLOSED" inside the update: a ticket closed a moment ago is not changed (count 0).
    const { count } = await tx.supportTicket.updateMany({
      where: { ...where, status: { not: "CLOSED" } },
      data: { status: nextStatus, updatedAt: new Date() },
    });
    if (count === 0) {
      return { ok: false, error: "ticketClosed" } as const;
    }
    const ticket = await tx.supportTicket.findFirstOrThrow({ where, select: { id: true, subject: true, userId: true } });
    await tx.ticketMessage.create({ data: { ticketId: ticket.id, senderId, body } });
    await notify(tx, ticket);
    return { ok: true } as const;
  });
}

/** The user writes again in THEIR ticket: it waits for an admin again (OPEN) and the admins are told. */
export async function addUserReply(ticketId: string, user: Writer, body: string): Promise<ActionResult> {
  return saveReply({ id: ticketId, userId: user.id }, user.id, body, "OPEN", (tx, ticket) =>
    notifyAllAdmins(userRepliedMessage(ticket, user.name), tx),
  );
}

/** The user closes THEIR ticket (their problem is solved). */
export async function closeUserTicket(ticketId: string, userId: string): Promise<ActionResult> {
  const { count } = await db.supportTicket.updateMany({
    where: { id: ticketId, userId, status: { not: "CLOSED" } },
    data: { status: "CLOSED" },
  });
  return count > 0 ? { ok: true } : { ok: false, error: "ticketClosed" };
}

// ─────────────────────────── The admin's side ───────────────────────────

/** Every ticket in one status (or all), the one with the latest activity first. For the admin's list. */
export async function listTicketsForAdmin(status: TicketStatus | null) {
  return db.supportTicket.findMany({
    where: status ? { status } : {},
    include: {
      user: { select: { name: true, phone: true, role: true } },
      booking: { select: { code: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

/** How many tickets have each status, e.g. { OPEN: 2, IN_PROGRESS: 1, CLOSED: 5 }. */
export async function countTicketsByStatus(): Promise<Partial<Record<TicketStatus, number>>> {
  const groups = await db.supportTicket.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: Partial<Record<TicketStatus, number>> = {};
  for (const group of groups) {
    counts[group.status] = group._count._all;
  }
  return counts;
}

/** Any ticket with its conversation and the user who opened it, or null. */
export async function getTicketForAdmin(ticketId: string) {
  return db.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      messages: TICKET_MESSAGES,
      user: { select: { name: true, phone: true, role: true } },
      booking: { select: { id: true, code: true } },
    },
  });
}

/** An admin answers a ticket: it now waits for the user (IN_PROGRESS) and the user is told. */
export async function addAdminReply(ticketId: string, adminId: string, body: string): Promise<ActionResult> {
  return saveReply({ id: ticketId }, adminId, body, "IN_PROGRESS", (tx, ticket) =>
    createNotification({ userId: ticket.userId, ...adminRepliedMessage(ticket) }, tx),
  );
}

/** An admin closes a ticket (the problem is solved, or there is nothing more to do). The user is told. */
export async function closeTicketByAdmin(ticketId: string): Promise<ActionResult> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.supportTicket.updateMany({
      where: { id: ticketId, status: { not: "CLOSED" } },
      data: { status: "CLOSED" },
    });
    if (count === 0) {
      return { ok: false, error: "ticketClosed" } as const;
    }
    const ticket = await tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId }, select: { id: true, subject: true, userId: true } });
    await createNotification({ userId: ticket.userId, ...ticketClosedMessage(ticket) }, tx);
    return { ok: true } as const;
  });
}
