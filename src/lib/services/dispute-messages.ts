/**
 * Complaint messages — the text (in English and Bangla) sent about a complaint ("dispute"):
 * to the admins and the provider when a farmer complains, and to the farmer and the provider
 * when the admin decides. Each function returns { title, titleBn, body, bodyBn, link },
 * ready for createNotification().
 */
import type { DisputeDecision } from "@/generated/prisma/enums";
import type { BookingMessageInfo } from "@/lib/services/booking-messages";

/** To every admin: a new complaint waits for a decision. */
export function complaintForAdminMessage(info: BookingMessageInfo, farmerName: string) {
  return {
    title: "New complaint",
    titleBn: "নতুন অভিযোগ",
    body: `${farmerName} complained about booking ${info.code} (${info.machineName}). Please check it and decide.`,
    bodyBn: `${farmerName} বুকিং ${info.code} (${info.machineName}) নিয়ে অভিযোগ করেছেন। অনুগ্রহ করে দেখে সিদ্ধান্ত দিন।`,
    link: "/admin/disputes",
  };
}

/** To the machine's provider: a farmer complained about one of their jobs. */
export function complaintForProviderMessage(info: BookingMessageInfo) {
  return {
    title: "A farmer complained",
    titleBn: "একজন কৃষক অভিযোগ করেছেন",
    body: `The farmer complained about booking ${info.code} (${info.machineName}). An admin will check it and decide.`,
    bodyBn: `কৃষক বুকিং ${info.code} (${info.machineName}) নিয়ে অভিযোগ করেছেন। একজন অ্যাডমিন দেখে সিদ্ধান্ত দেবেন।`,
    link: `/provider/bookings/${info.id}`,
  };
}

/** To the farmer: their complaint was received. */
export function complaintReceivedMessage(info: BookingMessageInfo) {
  return {
    title: "Complaint received",
    titleBn: "অভিযোগ পাওয়া গেছে",
    body: `We received your complaint about booking ${info.code}. An admin will check it and tell you the decision.`,
    bodyBn: `বুকিং ${info.code} নিয়ে আপনার অভিযোগ পাওয়া গেছে। একজন অ্যাডমিন দেখে সিদ্ধান্ত জানাবেন।`,
    link: `/farmer/bookings/${info.id}`,
  };
}

/** What a decision means for one person, in both languages (used inside the messages below). */
type DecisionText = { en: string; bn: string };

/** The farmer's sentence about the decision. */
function farmerDecisionText(decision: DisputeDecision, wasPaid: boolean, amount: number, newTotal: number): DecisionText {
  if (decision === "REFUND" && wasPaid) {
    return { en: `${amount} Tk is given back to you.`, bn: `আপনাকে ${amount} টাকা ফেরত দেওয়া হচ্ছে।` };
  }
  if (decision === "REFUND") {
    return { en: `Your bill is now ${newTotal} Tk (${amount} Tk less).`, bn: `আপনার বিল এখন ${newTotal} টাকা (${amount} টাকা কম)।` };
  }
  if (decision === "PENALTY") {
    return { en: "The provider was fined.", bn: "যন্ত্র মালিককে জরিমানা করা হয়েছে।" };
  }
  return { en: "No change was made.", bn: "কোনো পরিবর্তন করা হয়নি।" };
}

/** The provider's sentence about the decision. */
function providerDecisionText(decision: DisputeDecision, wasPaid: boolean, amount: number): DecisionText {
  if (decision === "REFUND" && wasPaid) {
    return { en: `${amount} Tk is given back to the farmer from your share.`, bn: `আপনার অংশ থেকে কৃষককে ${amount} টাকা ফেরত দেওয়া হচ্ছে।` };
  }
  if (decision === "REFUND") {
    return { en: `The bill was lowered by ${amount} Tk.`, bn: `বিল ${amount} টাকা কমানো হয়েছে।` };
  }
  if (decision === "PENALTY") {
    return { en: `You were fined ${amount} Tk. It comes off your next payout.`, bn: `আপনাকে ${amount} টাকা জরিমানা করা হয়েছে। এটি আপনার পরের টাকা থেকে কাটা হবে।` };
  }
  return { en: "No action was taken against you.", bn: "আপনার বিরুদ্ধে কোনো ব্যবস্থা নেওয়া হয়নি।" };
}

/** The facts both decision messages need. */
export type DecisionMessageFacts = {
  decision: DisputeDecision;
  wasPaid: boolean; // the farmer had paid before complaining
  amount: number; // the refund (or how much lower the bill is), or the fine
  newTotal: number; // what the farmer pays now
  note: string; // the admin's note
};

/** To the farmer: the admin decided their complaint. An unpaid booking can be paid now. */
export function decisionForFarmerMessage(info: BookingMessageInfo, facts: DecisionMessageFacts) {
  const text = farmerDecisionText(facts.decision, facts.wasPaid, facts.amount, facts.newTotal);
  const payNow = facts.wasPaid
    ? { en: "", bn: "" }
    : { en: ` You can pay ${facts.newTotal} Tk now.`, bn: ` এখন ${facts.newTotal} টাকা পরিশোধ করতে পারেন।` };
  return {
    title: "Complaint decided",
    titleBn: "অভিযোগের সিদ্ধান্ত",
    body: `Booking ${info.code}: ${text.en}${payNow.en} Note: ${facts.note}`,
    bodyBn: `বুকিং ${info.code}: ${text.bn}${payNow.bn} মন্তব্য: ${facts.note}`,
    link: `/farmer/bookings/${info.id}`,
  };
}

/** To the provider: the admin decided the complaint about their job. */
export function decisionForProviderMessage(info: BookingMessageInfo, facts: DecisionMessageFacts) {
  const text = providerDecisionText(facts.decision, facts.wasPaid, facts.amount);
  return {
    title: "Complaint decided",
    titleBn: "অভিযোগের সিদ্ধান্ত",
    body: `Booking ${info.code}: ${text.en} Note: ${facts.note}`,
    bodyBn: `বুকিং ${info.code}: ${text.bn} মন্তব্য: ${facts.note}`,
    link: `/provider/bookings/${info.id}`,
  };
}
