/**
 * Subsidy messages — the text of every message (simulated SMS) about farmer verification and
 * subsidy applications, in English and Bangla. They live here so verification.ts and
 * subsidy.ts stay short and easy to read.
 *
 * Each function returns { title, titleBn, body, bodyBn, link }, ready for createNotification().
 */
import { toBanglaDigits } from "@/lib/i18n";

/** To the officers of the farmer's upazila: a farmer sent their NID and land for checking. */
export function detailsSentMessage(farmerName: string) {
  return {
    title: "Farmer to verify",
    titleBn: "যাচাই করার মতো কৃষক",
    body: `${farmerName} sent their NID and land details. Please check and verify them.`,
    bodyBn: `${farmerName} তাঁর এনআইডি ও জমির তথ্য পাঠিয়েছেন। অনুগ্রহ করে যাচাই করুন।`,
    link: "/officer/farmers",
  };
}

/** To the farmer: the officer verified (or did not verify) their NID and land. */
export function verificationDecidedMessage(verified: boolean, reason: string) {
  if (verified) {
    return {
      title: "You are verified",
      titleBn: "আপনি যাচাইকৃত",
      body: "The agriculture officer verified your NID and land. You can now get a government subsidy.",
      bodyBn: "কৃষি কর্মকর্তা আপনার এনআইডি ও জমি যাচাই করেছেন। এখন আপনি সরকারি ভর্তুকি পেতে পারেন।",
      link: "/farmer/subsidy",
    };
  }
  return {
    title: "Details not verified",
    titleBn: "তথ্য যাচাই হয়নি",
    body: `The agriculture officer could not verify your details. Reason: ${reason}. Please fix them and send again.`,
    bodyBn: `কৃষি কর্মকর্তা আপনার তথ্য যাচাই করতে পারেননি। কারণ: ${reason}। ঠিক করে আবার পাঠান।`,
    link: "/farmer/subsidy",
  };
}

/** To the officers of the farmer's upazila: a new subsidy application. */
export function applicationSentMessage(farmerName: string, programName: string) {
  return {
    title: "New subsidy application",
    titleBn: "নতুন ভর্তুকি আবেদন",
    body: `${farmerName} applied for "${programName}".`,
    bodyBn: `${farmerName} "${programName}" এর জন্য আবেদন করেছেন।`,
    link: "/officer/subsidies",
  };
}

/** To the farmer: their subsidy application was approved or rejected. */
export function applicationDecidedMessage(
  approved: boolean,
  program: { name: string; nameBn: string; discountPercent: number },
  reason: string,
) {
  if (approved) {
    return {
      title: "Subsidy approved",
      titleBn: "ভর্তুকি অনুমোদিত",
      body: `Your application for "${program.name}" is approved. ${program.discountPercent}% of the work charge is now taken off your new bookings.`,
      bodyBn: `"${program.nameBn}" এর জন্য আপনার আবেদন অনুমোদিত হয়েছে। এখন থেকে নতুন বুকিংয়ে কাজের খরচের ${toBanglaDigits(program.discountPercent)}% কম লাগবে।`,
      link: "/farmer/subsidy",
    };
  }
  return {
    title: "Subsidy not approved",
    titleBn: "ভর্তুকি অনুমোদন পায়নি",
    body: `Your application for "${program.name}" was not approved. Reason: ${reason}.`,
    bodyBn: `"${program.nameBn}" এর জন্য আপনার আবেদন অনুমোদন পায়নি। কারণ: ${reason}।`,
    link: "/farmer/subsidy",
  };
}
