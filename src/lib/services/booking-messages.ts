/**
 * Booking messages — the text of every message (simulated SMS) a booking sends,
 * in English and Bangla. They live here so booking.ts stays short and easy to read.
 *
 * Each function returns { title, titleBn, body, bodyBn, link }, ready for createNotification().
 * The link opens the booking on the page of the person who gets the message.
 * Bangla texts use Bangla digits for codes, amounts and dates.
 */
import { toBanglaDigits } from "@/lib/i18n";

/** What every booking message needs to know about the booking. */
export type BookingMessageInfo = {
  id: string;
  code: string; // e.g. "KJ-2026-000123"
  machineName: string; // e.g. "Mahindra 575 DI"
  startAt: Date;
};

/**
 * A date and time in Bangladesh time, for a message.
 * Example: "Oct 20, 2026, 8:00 AM" (en) or "২০ অক্টো, ২০২৬, ৮:০০ AM" (bn)
 */
export function formatDhakaTime(date: Date, language: "en" | "bn"): string {
  const locale = language === "bn" ? "bn-BD" : "en";
  return new Intl.DateTimeFormat(locale, { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** The booking's page for the farmer, the provider and the operator. */
const farmerLink = (booking: BookingMessageInfo) => `/farmer/bookings/${booking.id}`;
const providerLink = (booking: BookingMessageInfo) => `/provider/bookings/${booking.id}`;

/** To the farmer, right after booking. */
export function requestSentMessage(booking: BookingMessageInfo, totalAmount: number) {
  const code = booking.code;
  return {
    title: "Booking request sent",
    titleBn: "বুকিং অনুরোধ পাঠানো হয়েছে",
    body:
      `Your booking ${code} (${booking.machineName}, ${formatDhakaTime(booking.startAt, "en")}) was sent to the provider. ` +
      `Estimated total: ${totalAmount} Tk. We will tell you when they answer.`,
    bodyBn:
      `আপনার বুকিং ${toBanglaDigits(code)} (${booking.machineName}, ${formatDhakaTime(booking.startAt, "bn")}) যন্ত্র মালিকের কাছে পাঠানো হয়েছে। ` +
      `আনুমানিক মোট: ${toBanglaDigits(totalAmount)} টাকা। তাঁরা উত্তর দিলে আমরা জানাব।`,
    link: farmerLink(booking),
  };
}

/** To the provider, when a farmer books one of their machines. */
export function newRequestMessage(booking: BookingMessageInfo, farmerName: string) {
  const code = booking.code;
  return {
    title: "New booking request",
    titleBn: "নতুন বুকিং অনুরোধ",
    body: `${farmerName} wants your ${booking.machineName} on ${formatDhakaTime(booking.startAt, "en")} (${code}). Please accept or reject it.`,
    bodyBn: `${farmerName} ${formatDhakaTime(booking.startAt, "bn")} সময়ে আপনার ${booking.machineName} চান (${toBanglaDigits(code)})। অনুগ্রহ করে গ্রহণ বা বাতিল করুন।`,
    link: providerLink(booking),
  };
}

/** To the farmer, when the provider accepts. The two OTP codes are only ever sent to the farmer. */
export function bookingAcceptedMessage(booking: BookingMessageInfo, startOtp: string, finishOtp: string) {
  const code = booking.code;
  return {
    title: "Booking accepted",
    titleBn: "বুকিং গৃহীত হয়েছে",
    body:
      `${code} is accepted. Start code: ${startOtp}. Finish code: ${finishOtp}. ` +
      `Give each code to the operator only when the work starts, and when it is finished.`,
    bodyBn:
      `${toBanglaDigits(code)} গৃহীত হয়েছে। শুরুর কোড: ${toBanglaDigits(startOtp)}। শেষের কোড: ${toBanglaDigits(finishOtp)}। ` +
      `কাজ শুরু হলে এবং শেষ হলে তবেই চালককে কোডটি দিন।`,
    link: farmerLink(booking),
  };
}

/** To the farmer, when the provider says no. */
export function bookingRejectedMessage(booking: BookingMessageInfo, reason: string) {
  const code = booking.code;
  return {
    title: "Booking not accepted",
    titleBn: "বুকিং গৃহীত হয়নি",
    body: `The provider cannot take ${code}. Reason: ${reason}. Please search for another machine.`,
    bodyBn: `যন্ত্র মালিক ${toBanglaDigits(code)} নিতে পারছেন না। কারণ: ${reason}। অনুগ্রহ করে অন্য যন্ত্র খুঁজুন।`,
    link: farmerLink(booking),
  };
}
