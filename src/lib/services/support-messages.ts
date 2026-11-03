/**
 * Support messages — the text (in English and Bangla) sent about support tickets:
 * to the admins when a ticket is opened or the user writes again, and to the user when an
 * admin answers or closes it. Each function returns { title, titleBn, body, bodyBn, link },
 * ready for createNotification().
 */

/** The facts every support message needs. */
export type TicketMessageInfo = { id: string; subject: string };

/** To every admin: a new ticket waits for an answer. */
export function newTicketMessage(ticket: TicketMessageInfo, userName: string) {
  return {
    title: "New support ticket",
    titleBn: "নতুন সহায়তা টিকিট",
    body: `${userName} asks for help: "${ticket.subject}".`,
    bodyBn: `${userName} সাহায্য চেয়েছেন: "${ticket.subject}"।`,
    link: `/admin/tickets/${ticket.id}`,
  };
}

/** To every admin: the user wrote again in their ticket. */
export function userRepliedMessage(ticket: TicketMessageInfo, userName: string) {
  return {
    title: "New reply in a ticket",
    titleBn: "টিকিটে নতুন উত্তর",
    body: `${userName} wrote again in "${ticket.subject}".`,
    bodyBn: `${userName} "${ticket.subject}" টিকিটে আবার লিখেছেন।`,
    link: `/admin/tickets/${ticket.id}`,
  };
}

/** To the user: an admin answered their ticket. */
export function adminRepliedMessage(ticket: TicketMessageInfo) {
  return {
    title: "Support answered",
    titleBn: "সহায়তা দল উত্তর দিয়েছে",
    body: `The KrishiJontro team answered your ticket "${ticket.subject}". Open it to read the answer.`,
    bodyBn: `আপনার "${ticket.subject}" টিকিটে কৃষিযন্ত্র দল উত্তর দিয়েছে। উত্তর পড়তে টিকিটটি খুলুন।`,
    link: `/support/${ticket.id}`,
  };
}

/** To the user: an admin closed their ticket. */
export function ticketClosedMessage(ticket: TicketMessageInfo) {
  return {
    title: "Ticket closed",
    titleBn: "টিকিট বন্ধ",
    body: `Your ticket "${ticket.subject}" was closed. If you still need help, open a new ticket.`,
    bodyBn: `আপনার "${ticket.subject}" টিকিট বন্ধ করা হয়েছে। আরও সাহায্য লাগলে নতুন টিকিট খুলুন।`,
    link: `/support/${ticket.id}`,
  };
}
