// Zod rules for support tickets (help requests to the KrishiJontro team):
//   newTicketSchema — a new ticket: a short subject, maybe a booking, and the first message
//   replySchema     — one more message in a ticket's conversation
// The same rules run in the browser (the forms) and on the server (the server actions).
import { z } from "zod";

export const newTicketSchema = z.object({
  subject: z.string().trim().min(3, "subjectRequired").max(100, "tooLong"),
  bookingId: z.string(), // "" = not about one booking
  message: z.string().trim().min(5, "messageRequired").max(1000, "tooLong"),
});

export type NewTicketInput = z.infer<typeof newTicketSchema>;

export const replySchema = z.object({
  body: z.string().trim().min(2, "messageRequired").max(1000, "tooLong"),
});

export type ReplyInput = z.infer<typeof replySchema>;
