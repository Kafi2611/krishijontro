/**
 * Waitlist messages — the text (in English and Bangla) sent to a farmer on the waitlist.
 * Each function returns { title, titleBn, body, bodyBn, link }, ready for createNotification().
 */
import { formatDhakaDay } from "@/lib/services/booking-messages";

/** To the first waiting farmer, when a machine of the kind they wait for may be free near their field. */
export function machineFreeMessage(machineType: { name: string; nameBn: string }, day: string, searchLink: string) {
  return {
    title: "A machine may be free",
    titleBn: "একটি যন্ত্র খালি হতে পারে",
    body: `A ${machineType.name} near your field may be free on ${formatDhakaDay(day, "en")}. Search now to book it before someone else does.`,
    bodyBn: `${formatDhakaDay(day, "bn")} তারিখে আপনার জমির কাছে একটি ${machineType.nameBn} খালি হতে পারে। অন্য কেউ নেওয়ার আগে এখনই খুঁজে বুক করুন।`,
    link: searchLink,
  };
}
