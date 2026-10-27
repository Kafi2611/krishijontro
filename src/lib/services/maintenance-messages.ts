/**
 * Maintenance messages — the text of every message (in English and Bangla) about repairs,
 * services and engine-hour alerts. They live here so maintenance.ts stays short.
 *
 * Each function returns { title, titleBn, body, bodyBn, link }, ready for createNotification().
 */
import type { MaintenanceStatus, MaintenanceType } from "@/generated/prisma/enums";
import { toBanglaDigits } from "@/lib/i18n";
import type { ServiceState } from "@/lib/services/maintenance-rules";

/** A repair or service, in English and Bangla. */
const TYPE_WORDS: Record<MaintenanceType, { en: string; bn: string }> = {
  REPAIR: { en: "repair", bn: "মেরামত" },
  SERVICE: { en: "service", bn: "সার্ভিসিং" },
};

/** The repair steps, in English and Bangla. */
const STEP_WORDS: Record<MaintenanceStatus, { en: string; bn: string }> = {
  RECEIVED: { en: "received", bn: "গৃহীত" },
  INSPECTING: { en: "being inspected", bn: "পরীক্ষা চলছে" },
  REPAIRING: { en: "being repaired", bn: "মেরামত চলছে" },
  FIXED: { en: "fixed", bn: "ঠিক হয়েছে" },
};

/** The machine's page for the provider. */
const providerMachineLink = (machineId: string) => `/provider/machines/${machineId}`;

/** To every technician, when a provider (or a breakdown) asks for a repair or a service. */
export function newMaintenanceRequestMessage(
  request: { id: string; type: MaintenanceType; description: string },
  machineName: string,
) {
  const type = TYPE_WORDS[request.type];
  return {
    title: request.type === "REPAIR" ? "New repair request" : "New service request",
    titleBn: request.type === "REPAIR" ? "নতুন মেরামতের অনুরোধ" : "নতুন সার্ভিসিংয়ের অনুরোধ",
    body: `${machineName} needs a ${type.en}: ${request.description}`,
    bodyBn: `${machineName} এর ${type.bn} দরকার: ${request.description}`,
    link: `/technician/requests/${request.id}`,
  };
}

/** To the provider, when the technician takes the request or moves it to the next step. */
export function maintenanceStepMessage(
  machine: { id: string; name: string },
  status: MaintenanceStatus,
  technicianName: string,
) {
  const step = STEP_WORDS[status];
  return {
    title: "Repair update",
    titleBn: "মেরামতের খবর",
    body: `${machine.name}: ${step.en} by ${technicianName}.`,
    bodyBn: `${machine.name}: ${technicianName} — ${step.bn}।`,
    link: providerMachineLink(machine.id),
  };
}

/** To the provider, when the technician marks the machine fixed and fit for work. */
export function machineFitMessage(machine: { id: string; name: string }, totalCost: number) {
  return {
    title: "Machine fit for work",
    titleBn: "যন্ত্র কাজের উপযোগী",
    body: `${machine.name} is fixed and fit for work again. Cost: ${totalCost} Tk (parts + labour).`,
    bodyBn: `${machine.name} ঠিক হয়েছে, আবার কাজের উপযোগী। খরচ: ${toBanglaDigits(totalCost)} টাকা (যন্ত্রাংশ + মজুরি)।`,
    link: providerMachineLink(machine.id),
  };
}

/** To the provider, when a job moves the machine close to its service ("soon") or to it ("due"). */
export function serviceAlertMessage(machine: { id: string; name: string }, state: ServiceState, hoursLeft: number) {
  if (state === "due") {
    return {
      title: "Service due",
      titleBn: "সার্ভিসিং দরকার",
      body: `${machine.name} has reached its service hours. Farmers cannot book it until a technician services it.`,
      bodyBn: `${machine.name} সার্ভিসিংয়ের সময়ে পৌঁছেছে। টেকনিশিয়ান সার্ভিসিং না করা পর্যন্ত কৃষকেরা এটি বুক করতে পারবেন না।`,
      link: providerMachineLink(machine.id),
    };
  }
  return {
    title: "Service soon",
    titleBn: "শীঘ্রই সার্ভিসিং",
    body: `${machine.name} has only ${hoursLeft} engine hours left before its service. Please ask for a service.`,
    bodyBn: `${machine.name} এর সার্ভিসিংয়ের আর মাত্র ${toBanglaDigits(hoursLeft)} ইঞ্জিন-ঘণ্টা বাকি। অনুগ্রহ করে সার্ভিসিংয়ের অনুরোধ করুন।`,
    link: providerMachineLink(machine.id),
  };
}
