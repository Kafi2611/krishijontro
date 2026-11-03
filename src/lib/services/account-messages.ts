/**
 * Account messages — the text (in English and Bangla) sent when the admin changes an account:
 * suspended, active again, or a new staff account made for someone.
 * Each function returns { title, titleBn, body, bodyBn }, ready for createNotification().
 */
import type { Role } from "@/generated/prisma/enums";

/** The role names used inside messages (the app's own names, see "Roles" in messages/*.json). */
const ROLE_NAMES: Record<Role, { en: string; bn: string }> = {
  FARMER: { en: "farmer", bn: "কৃষক" },
  COOP_LEADER: { en: "cooperative leader", bn: "সমবায় নেতা" },
  PROVIDER: { en: "machine provider", bn: "যন্ত্র মালিক" },
  OPERATOR: { en: "operator", bn: "চালক" },
  TECHNICIAN: { en: "technician", bn: "টেকনিশিয়ান" },
  OFFICER: { en: "agriculture officer", bn: "কৃষি কর্মকর্তা" },
  GOVT: { en: "government authority", bn: "সরকারি কর্তৃপক্ষ" },
  ADMIN: { en: "admin", bn: "অ্যাডমিন" },
};

/** To a user the admin suspended. They see it if the account is made active again. */
export function accountSuspendedMessage(reason: string) {
  return {
    title: "Account suspended",
    titleBn: "অ্যাকাউন্ট স্থগিত",
    body: `Your KrishiJontro account was suspended. Reason: ${reason}`,
    bodyBn: `আপনার কৃষিযন্ত্র অ্যাকাউন্ট স্থগিত করা হয়েছে। কারণ: ${reason}`,
  };
}

/** To a user whose account the admin made active again. */
export function accountActivatedMessage() {
  return {
    title: "Account active again",
    titleBn: "অ্যাকাউন্ট আবার চালু",
    body: "Your KrishiJontro account is active again. You can log in and use it as before.",
    bodyBn: "আপনার কৃষিযন্ত্র অ্যাকাউন্ট আবার চালু হয়েছে। আগের মতো লগইন করে ব্যবহার করতে পারবেন।",
  };
}

/** To a new staff member whose account the admin made. The password is told in person, never sent. */
export function staffWelcomeMessage(role: Role) {
  const roleName = ROLE_NAMES[role];
  return {
    title: "Welcome to KrishiJontro",
    titleBn: "কৃষিযন্ত্রে স্বাগতম",
    body: `An admin made a ${roleName.en} account for you. Log in with this mobile number and the password the admin gave you.`,
    bodyBn: `একজন অ্যাডমিন আপনার জন্য ${roleName.bn} অ্যাকাউন্ট খুলেছেন। এই মোবাইল নম্বর আর অ্যাডমিনের দেওয়া পাসওয়ার্ড দিয়ে লগইন করুন।`,
  };
}
