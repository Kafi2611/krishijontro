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

/**
 * A day ("YYYY-MM-DD") for a message, without a time.
 * Example: "Oct 20, 2026" (en) or "২০ অক্টো, ২০২৬" (bn)
 */
export function formatDhakaDay(day: string, language: "en" | "bn"): string {
  const locale = language === "bn" ? "bn-BD" : "en";
  // Noon in Dhaka, so the day is the same in every time zone the server may run in.
  const noon = new Date(`${day}T12:00:00+06:00`);
  return new Intl.DateTimeFormat(locale, { timeZone: "Asia/Dhaka", dateStyle: "medium" }).format(noon);
}

/** The booking's page for the farmer, the provider and the operator. */
const farmerLink = (booking: BookingMessageInfo) => `/farmer/bookings/${booking.id}`;
const providerLink = (booking: BookingMessageInfo) => `/provider/bookings/${booking.id}`;
const operatorLink = (booking: BookingMessageInfo) => `/operator/jobs/${booking.id}`;

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

/** To the operator, when the provider sends them to a job. */
export function newJobMessage(
  booking: BookingMessageInfo,
  farmer: { name: string; phone: string },
  fieldAddress: string | null,
) {
  const code = booking.code;
  const place = fieldAddress ? `, ${fieldAddress}` : "";
  return {
    title: "New job",
    titleBn: "নতুন কাজ",
    body: `Job ${code}: ${booking.machineName} on ${formatDhakaTime(booking.startAt, "en")} for ${farmer.name} (${farmer.phone})${place}.`,
    bodyBn:
      `কাজ ${toBanglaDigits(code)}: ${formatDhakaTime(booking.startAt, "bn")} সময়ে ${farmer.name} (${toBanglaDigits(farmer.phone)}) এর জন্য ` +
      `${booking.machineName}${place}।`,
    link: operatorLink(booking),
  };
}

/** To the farmer, when an operator is chosen for the booking. */
export function operatorAssignedMessage(booking: BookingMessageInfo, operator: { name: string; phone: string }) {
  const code = booking.code;
  return {
    title: "Operator chosen",
    titleBn: "চালক ঠিক হয়েছে",
    body: `${operator.name} (${operator.phone}) will bring the machine for ${code} on ${formatDhakaTime(booking.startAt, "en")}.`,
    bodyBn: `${operator.name} (${toBanglaDigits(operator.phone)}) ${formatDhakaTime(booking.startAt, "bn")} সময়ে ${toBanglaDigits(code)} এর জন্য যন্ত্র নিয়ে আসবেন।`,
    link: farmerLink(booking),
  };
}

/** To the farmer, when the operator sets off with the machine. */
export function onTheWayMessage(booking: BookingMessageInfo, operatorName: string) {
  const code = booking.code;
  return {
    title: "Operator on the way",
    titleBn: "চালক রওনা দিয়েছেন",
    body: `${operatorName} is on the way with the machine for ${code}.`,
    bodyBn: `${operatorName} ${toBanglaDigits(code)} এর জন্য যন্ত্র নিয়ে রওনা দিয়েছেন।`,
    link: farmerLink(booking),
  };
}

/** To the farmer, when the operator reaches the field. */
export function arrivedMessage(booking: BookingMessageInfo, operatorName: string) {
  const code = booking.code;
  return {
    title: "Operator has arrived",
    titleBn: "চালক পৌঁছেছেন",
    body: `${operatorName} has reached your field (${code}). Give the start code when the work begins.`,
    bodyBn: `${operatorName} আপনার জমিতে পৌঁছেছেন (${toBanglaDigits(code)})। কাজ শুরু হলে শুরুর কোড দিন।`,
    link: farmerLink(booking),
  };
}

/** To the farmer, when the work starts. */
export function workStartedMessage(booking: BookingMessageInfo) {
  const code = booking.code;
  return {
    title: "Work started",
    titleBn: "কাজ শুরু হয়েছে",
    body: `Work on ${code} has started. Give the finish code only when the work is done.`,
    bodyBn: `${toBanglaDigits(code)} এর কাজ শুরু হয়েছে। কাজ শেষ হলে তবেই শেষের কোড দিন।`,
    link: farmerLink(booking),
  };
}

/** To the farmer, when the work is finished: the final bill. */
export function workFinishedMessage(booking: BookingMessageInfo, totalAmount: number) {
  const code = booking.code;
  return {
    title: "Work finished",
    titleBn: "কাজ শেষ হয়েছে",
    body: `Work on ${code} is finished. Your final bill is ${totalAmount} Tk.`,
    bodyBn: `${toBanglaDigits(code)} এর কাজ শেষ হয়েছে। আপনার চূড়ান্ত বিল ${toBanglaDigits(totalAmount)} টাকা।`,
    link: farmerLink(booking),
  };
}

/** To the provider, when their operator finishes a job: the provider's share. */
export function jobFinishedMessage(booking: BookingMessageInfo, providerAmount: number) {
  const code = booking.code;
  return {
    title: "Job finished",
    titleBn: "কাজ শেষ হয়েছে",
    body: `${code} (${booking.machineName}) is finished. Your share: ${providerAmount} Tk, after the platform fee.`,
    bodyBn: `${toBanglaDigits(code)} (${booking.machineName}) শেষ হয়েছে। আপনার পাওনা: ${toBanglaDigits(providerAmount)} টাকা (প্ল্যাটফর্ম ফি বাদে)।`,
    link: providerLink(booking),
  };
}

/** To the provider, when the farmer reviews a paid job: the machine's and the operator's stars. */
export function newReviewMessage(booking: BookingMessageInfo, machineStars: number, operatorStars: number | null) {
  const code = booking.code;
  const operatorPart = operatorStars === null ? "" : `, operator ${operatorStars}/5`;
  const operatorPartBn = operatorStars === null ? "" : `, চালক ${toBanglaDigits(operatorStars)}/৫`;
  return {
    title: "New review",
    titleBn: "নতুন রিভিউ",
    body: `The farmer reviewed ${code} (${booking.machineName}): machine ${machineStars}/5${operatorPart}.`,
    bodyBn: `কৃষক ${toBanglaDigits(code)} (${booking.machineName}) এর রিভিউ দিয়েছেন: যন্ত্র ${toBanglaDigits(machineStars)}/৫${operatorPartBn}।`,
    link: providerLink(booking),
  };
}

/** To the operator, when the farmer rates their work. */
export function operatorReviewedMessage(booking: BookingMessageInfo, stars: number) {
  const code = booking.code;
  return {
    title: "You got a rating",
    titleBn: "আপনি রেটিং পেয়েছেন",
    body: `The farmer gave you ${stars} of 5 stars for ${code}.`,
    bodyBn: `${toBanglaDigits(code)} এর জন্য কৃষক আপনাকে ৫ এর মধ্যে ${toBanglaDigits(stars)} তারা দিয়েছেন।`,
    link: operatorLink(booking),
  };
}
