/**
 * Cooperative messages — the text (in English and Bangla) sent to a farmer when a cooperative
 * leader adds them as a member, removes them, or books a machine for their plot (group booking).
 * Each function returns { title, titleBn, body, bodyBn, link }, ready for createNotification().
 */
import { formatDhakaTime, type BookingMessageInfo } from "@/lib/services/booking-messages";

/** To a farmer: they are now a member of a cooperative. */
export function memberAddedMessage(cooperativeName: string, leaderName: string) {
  return {
    title: "You joined a cooperative",
    titleBn: "আপনি একটি সমবায়ে যুক্ত হয়েছেন",
    body: `${leaderName} added you to ${cooperativeName}. The leader can now book machines for your plot together with other members.`,
    bodyBn: `${leaderName} আপনাকে ${cooperativeName}-এ যুক্ত করেছেন। নেতা এখন অন্য সদস্যদের সঙ্গে আপনার জমির জন্যও যন্ত্র বুক করতে পারবেন।`,
    link: "/farmer/bookings",
  };
}

/** To a farmer: they are no longer a member. */
export function memberRemovedMessage(cooperativeName: string) {
  return {
    title: "Removed from a cooperative",
    titleBn: "সমবায় থেকে বাদ",
    body: `You are no longer a member of ${cooperativeName}. Your bookings stay as they are.`,
    bodyBn: `আপনি আর ${cooperativeName}-এর সদস্য নন। আপনার বুকিংগুলো আগের মতোই থাকবে।`,
  };
}

/** To a member farmer: the leader booked a machine for their plot (their own booking, with a share of the delivery). */
export function groupBookedForYouMessage(info: BookingMessageInfo, cooperativeName: string, totalAmount: number) {
  return {
    title: "Your cooperative booked a machine for you",
    titleBn: "আপনার সমবায় আপনার জন্য যন্ত্র বুক করেছে",
    body: `${cooperativeName} booked ${info.machineName} for your plot on ${formatDhakaTime(info.startAt, "en")} (booking ${info.code}). You pay about ${totalAmount} Tk after the work.`,
    bodyBn: `${cooperativeName} ${formatDhakaTime(info.startAt, "bn")} সময়ে আপনার জমির জন্য ${info.machineName} বুক করেছে (বুকিং ${info.code})। কাজ শেষে আপনি প্রায় ${totalAmount} টাকা দেবেন।`,
    link: `/farmer/bookings/${info.id}`,
  };
}

/** To the provider: one group booking = several requests, one after another on the same machine. */
export function groupRequestMessage(machineName: string, cooperativeName: string, count: number, startAt: Date) {
  return {
    title: "Group booking request",
    titleBn: "দলগত বুকিংয়ের অনুরোধ",
    body: `${cooperativeName} asks for your ${machineName} for ${count} plots, one after another, from ${formatDhakaTime(startAt, "en")}. Please accept or reject each request.`,
    bodyBn: `${cooperativeName} ${formatDhakaTime(startAt, "bn")} থেকে পরপর ${count}টি জমির জন্য আপনার ${machineName} চেয়েছে। অনুগ্রহ করে প্রতিটি অনুরোধ গ্রহণ বা বাতিল করুন।`,
    link: "/provider/bookings",
  };
}
