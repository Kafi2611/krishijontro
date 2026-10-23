/**
 * Payment messages — the text of every message (simulated SMS) about money, in English and
 * Bangla: a payment received, a booking paid twice, a refund and a payout.
 * They live here so payment.ts, refund.ts and payout.ts stay short and easy to read.
 *
 * Each function returns { title, titleBn, body, bodyBn, link }, ready for createNotification().
 * Bangla texts use Bangla digits for codes and amounts.
 */
import type { PaymentMethod } from "@/generated/prisma/enums";
import type { BookingMessageInfo } from "@/lib/services/booking-messages";
import { toBanglaDigits } from "@/lib/i18n";

/** "in cash" or "online", in English and Bangla. */
function howPaid(method: PaymentMethod) {
  if (method === "CASH") {
    return { en: "in cash", bn: "নগদে" };
  }
  return { en: "online", bn: "অনলাইনে" };
}

/** To the farmer, when their payment is received. */
export function paymentReceivedMessage(booking: BookingMessageInfo, amount: number, method: PaymentMethod) {
  const code = booking.code;
  const how = howPaid(method);
  return {
    title: "Payment received",
    titleBn: "টাকা পাওয়া গেছে",
    body: `We received ${amount} Tk ${how.en} for ${code}. Thank you! You can download the receipt from the booking page.`,
    bodyBn: `${toBanglaDigits(code)} এর জন্য ${how.bn} ${toBanglaDigits(amount)} টাকা পাওয়া গেছে। ধন্যবাদ! বুকিং পাতা থেকে রসিদ নামাতে পারবেন।`,
    link: `/farmer/bookings/${booking.id}`,
  };
}

/** To the provider, when the farmer has paid for a job of their machine. */
export function bookingPaidMessage(booking: BookingMessageInfo, amount: number, method: PaymentMethod, share: number) {
  const code = booking.code;
  const how = howPaid(method);
  return {
    title: "Booking paid",
    titleBn: "বুকিংয়ের টাকা পরিশোধ হয়েছে",
    body: `The farmer paid ${amount} Tk ${how.en} for ${code} (${booking.machineName}). Your share is ${share} Tk.`,
    bodyBn: `কৃষক ${toBanglaDigits(code)} (${booking.machineName}) এর জন্য ${how.bn} ${toBanglaDigits(amount)} টাকা দিয়েছেন। আপনার পাওনা ${toBanglaDigits(share)} টাকা।`,
    link: `/provider/bookings/${booking.id}`,
  };
}

/** To every admin, when a booking that was already paid gets paid again (it must be refunded). */
export function paidTwiceMessage(bookingCode: string, amount: number) {
  return {
    title: "Booking paid twice",
    titleBn: "বুকিংয়ের টাকা দুইবার পরিশোধ হয়েছে",
    body: `${bookingCode} was already paid, and ${amount} Tk came in again online. Please refund the second payment.`,
    bodyBn: `${toBanglaDigits(bookingCode)} আগেই পরিশোধ হয়েছিল, আবার অনলাইনে ${toBanglaDigits(amount)} টাকা এসেছে। দ্বিতীয় পেমেন্টটি ফেরত দিন।`,
    link: "/admin/payments",
  };
}

/** To the farmer, when money is given back to them. */
export function refundMessage(booking: { id: string; code: string }, amount: number, method: PaymentMethod, reason: string) {
  const code = booking.code;
  const where =
    method === "CASH"
      ? { en: "We will send it to you by bKash or cash.", bn: "আমরা বিকাশ বা নগদে পাঠিয়ে দেব।" }
      : { en: "It goes back to the card or account you paid with.", bn: "যে কার্ড বা অ্যাকাউন্ট থেকে দিয়েছিলেন সেখানে ফেরত যাবে।" };
  return {
    title: "Money refunded",
    titleBn: "টাকা ফেরত দেওয়া হয়েছে",
    body: `${amount} Tk of ${code} is refunded. Reason: ${reason}. ${where.en}`,
    bodyBn: `${toBanglaDigits(code)} এর ${toBanglaDigits(amount)} টাকা ফেরত দেওয়া হয়েছে। কারণ: ${reason}। ${where.bn}`,
    link: `/farmer/bookings/${booking.id}`,
  };
}

/** To the provider, when the admin sends them their money. */
export function payoutSentMessage(amount: number, bookingCount: number, reference: string) {
  return {
    title: "Payout sent",
    titleBn: "পাওনা টাকা পাঠানো হয়েছে",
    body: `We sent you ${amount} Tk for ${bookingCount} booking(s). Reference: ${reference}.`,
    bodyBn: `${toBanglaDigits(bookingCount)}টি বুকিংয়ের জন্য আপনাকে ${toBanglaDigits(amount)} টাকা পাঠানো হয়েছে। রেফারেন্স: ${reference}।`,
    link: "/provider/earnings",
  };
}
