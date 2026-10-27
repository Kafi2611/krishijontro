/**
 * Breakdown messages — the text of every message (in English and Bangla) sent when a machine
 * breaks down: to the farmer, the provider, the admins, and the providers who could send a
 * replacement. They live here so breakdown.ts and replacement.ts stay short.
 *
 * Each function returns { title, titleBn, body, bodyBn, link }, ready for createNotification().
 */
import { toBanglaDigits } from "@/lib/i18n";
import { formatDhakaTime, type BookingMessageInfo } from "@/lib/services/booking-messages";

/** The booking's page for the farmer and the provider. */
const farmerLink = (booking: { id: string }) => `/farmer/bookings/${booking.id}`;
const providerLink = (booking: { id: string }) => `/provider/bookings/${booking.id}`;

/** To the farmer, right after the operator reports the breakdown. */
export function breakdownFarmerMessage(booking: BookingMessageInfo, radiusKm: number) {
  const code = booking.code;
  return {
    title: "Machine broke down",
    titleBn: "যন্ত্র নষ্ট হয়েছে",
    body:
      `The machine of ${code} broke down. We are looking for another machine within ${radiusKm} km to finish your work. ` +
      `You pay only for the work that was done.`,
    bodyBn:
      `${toBanglaDigits(code)} এর যন্ত্রটি নষ্ট হয়েছে। আপনার কাজ শেষ করতে আমরা ${toBanglaDigits(radiusKm)} কিমির মধ্যে অন্য যন্ত্র খুঁজছি। ` +
      `যতটুকু কাজ হয়েছে, শুধু ততটুকুর টাকা দেবেন।`,
    link: farmerLink(booking),
  };
}

/** To the provider of the broken machine. */
export function breakdownProviderMessage(booking: BookingMessageInfo, operatorName: string) {
  const code = booking.code;
  return {
    title: "Your machine broke down",
    titleBn: "আপনার যন্ত্র নষ্ট হয়েছে",
    body: `${operatorName} reported that ${booking.machineName} broke down during ${code}. A repair request was sent to the technicians.`,
    bodyBn: `${operatorName} জানিয়েছেন ${toBanglaDigits(code)} এর কাজের সময় ${booking.machineName} নষ্ট হয়েছে। টেকনিশিয়ানদের কাছে মেরামতের অনুরোধ পাঠানো হয়েছে।`,
    link: providerLink(booking),
  };
}

/** To every admin: a farmer is waiting for a replacement machine. */
export function breakdownAdminMessage(booking: BookingMessageInfo) {
  const code = booking.code;
  return {
    title: "Breakdown: replacement needed",
    titleBn: "যন্ত্র নষ্ট: বিকল্প যন্ত্র দরকার",
    body: `${booking.machineName} broke down during ${code}. Nearby providers were asked to send a replacement.`,
    bodyBn: `${toBanglaDigits(code)} এর কাজের সময় ${booking.machineName} নষ্ট হয়েছে। কাছের যন্ত্র মালিকদের বিকল্প যন্ত্র পাঠাতে বলা হয়েছে।`,
    link: "/admin/breakdowns",
  };
}

/** To the provider of a free machine nearby: can they send it? */
export function replacementOfferMessage(booking: { code: string }, machineType: { name: string; nameBn: string }) {
  const code = booking.code;
  return {
    title: "Emergency: a farmer needs your machine",
    titleBn: "জরুরি: একজন কৃষকের আপনার যন্ত্র দরকার",
    body: `A ${machineType.name} broke down near your free ${machineType.name} (booking ${code}). The first provider to send a machine gets the job. Open Bookings to send yours.`,
    bodyBn: `আপনার খালি ${machineType.nameBn} এর কাছে একটি ${machineType.nameBn} নষ্ট হয়েছে (বুকিং ${toBanglaDigits(code)})। যিনি প্রথমে যন্ত্র পাঠাবেন, কাজটি তাঁর। পাঠাতে বুকিং পাতা খুলুন।`,
    link: "/provider/bookings",
  };
}

/** To the farmer: another machine will finish the work (a new booking, with its own codes). */
export function replacementFoundMessage(replacement: BookingMessageInfo, brokenCode: string, startOtp: string, finishOtp: string) {
  return {
    title: "Replacement machine coming",
    titleBn: "বিকল্প যন্ত্র আসছে",
    body:
      `${replacement.machineName} will finish the work of ${brokenCode} at ${formatDhakaTime(replacement.startAt, "en")} (new booking ${replacement.code}, free delivery). ` +
      `Start code: ${startOtp}. Finish code: ${finishOtp}.`,
    bodyBn:
      `${formatDhakaTime(replacement.startAt, "bn")} সময়ে ${replacement.machineName} ${toBanglaDigits(brokenCode)} এর বাকি কাজ শেষ করবে (নতুন বুকিং ${toBanglaDigits(replacement.code)}, ডেলিভারি ফ্রি)। ` +
      `শুরুর কোড: ${toBanglaDigits(startOtp)}। শেষের কোড: ${toBanglaDigits(finishOtp)}।`,
    link: farmerLink(replacement),
  };
}

/** To the farmer: the bill of the broken booking, for the work done before the breakdown. */
export function workDoneBillMessage(booking: BookingMessageInfo, totalAmount: number) {
  const code = booking.code;
  return {
    title: "Bill for the work done",
    titleBn: "হয়ে যাওয়া কাজের বিল",
    body: `${code} is closed after the breakdown. You pay only for the work done before it: ${totalAmount} Tk.`,
    bodyBn: `যন্ত্র নষ্ট হওয়ায় ${toBanglaDigits(code)} বন্ধ হয়েছে। নষ্ট হওয়ার আগে যতটুকু কাজ হয়েছে, শুধু তার টাকা দেবেন: ${toBanglaDigits(totalAmount)} টাকা।`,
    link: farmerLink(booking),
  };
}

/** To the provider of the broken machine, when the booking is closed (replacement found, or not). */
export function brokenJobClosedMessage(booking: BookingMessageInfo, providerAmount: number) {
  const code = booking.code;
  return {
    title: "Job closed after the breakdown",
    titleBn: "যন্ত্র নষ্ট হওয়ায় কাজ বন্ধ",
    body: `${code} is closed. Your share for the work done before the breakdown: ${providerAmount} Tk.`,
    bodyBn: `${toBanglaDigits(code)} বন্ধ হয়েছে। নষ্ট হওয়ার আগের কাজের জন্য আপনার পাওনা: ${toBanglaDigits(providerAmount)} টাকা।`,
    link: providerLink(booking),
  };
}

/** To the farmer: nobody could send a machine. They pay only for the work done and join the waitlist. */
export function noReplacementFarmerMessage(booking: BookingMessageInfo, totalAmount: number) {
  const code = booking.code;
  const youPay = totalAmount > 0 ? `You pay only for the work done: ${totalAmount} Tk.` : "You pay nothing.";
  const youPayBn = totalAmount > 0 ? `শুধু হয়ে যাওয়া কাজের টাকা দেবেন: ${toBanglaDigits(totalAmount)} টাকা।` : "আপনাকে কোনো টাকা দিতে হবে না।";
  return {
    title: "No replacement machine found",
    titleBn: "বিকল্প যন্ত্র পাওয়া যায়নি",
    body: `Sorry, no other machine could come for ${code}. ${youPay} You are on the waitlist: we will tell you when a machine is free near you.`,
    bodyBn: `দুঃখিত, ${toBanglaDigits(code)} এর জন্য অন্য কোনো যন্ত্র আসতে পারেনি। ${youPayBn} আপনাকে অপেক্ষার তালিকায় রাখা হয়েছে: কাছে যন্ত্র খালি হলে জানাব।`,
    link: farmerLink(booking),
  };
}

/** To the provider of the broken machine, when no replacement came and nothing was done (cancelled). */
export function brokenJobCancelledMessage(booking: BookingMessageInfo) {
  const code = booking.code;
  return {
    title: "Job cancelled after the breakdown",
    titleBn: "যন্ত্র নষ্ট হওয়ায় কাজ বাতিল",
    body: `No replacement machine was found for ${code}, and no work was done before the breakdown, so the booking is cancelled.`,
    bodyBn: `${toBanglaDigits(code)} এর জন্য বিকল্প যন্ত্র পাওয়া যায়নি, আর নষ্ট হওয়ার আগে কোনো কাজ হয়নি, তাই বুকিংটি বাতিল হয়েছে।`,
    link: providerLink(booking),
  };
}
