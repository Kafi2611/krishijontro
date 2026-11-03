/**
 * Group booking service — a cooperative leader books ONE machine for many members' plots in
 * their village, one plot after another (the math is in group-booking-rules.ts).
 *
 * 1. getGroupFormData():   what the form needs: the cooperative, its members, the machine types.
 * 2. findGroupMachines():  the machines of the chosen type that are free for the WHOLE back-to-back
 *                          time, near the village pin, each with every plot's price.
 * 3. createGroupBooking(): inside ONE transaction (like a single booking): lock the machine, check
 *                          nothing overlaps the whole time, save one GroupBooking and one normal
 *                          Booking per member (each member is the farmer of their own booking:
 *                          they get their own codes, pay their own bill and can cancel their own
 *                          plot). The delivery is charged once and shared equally, and the
 *                          minimum charge is checked once for all plots together.
 * The provider then accepts or rejects each member's request like any other booking.
 * Every function takes the leader's own id, so a leader only books for THEIR cooperative.
 */
import type { BillingUnit } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  BookingProblem,
  findTimeClash,
  insertNewBooking,
  retryIfCodeTaken,
} from "@/lib/services/booking";
import { estimateWorkHours, getJobStartAt } from "@/lib/services/booking-rules";
import { addDays, toDhakaDay, type TimeRange } from "@/lib/services/calendar";
import { getLeaderCooperative } from "@/lib/services/cooperative";
import { groupBookedForYouMessage, groupRequestMessage } from "@/lib/services/cooperative-messages";
import { BANGLADESH_CENTER, distanceInKm } from "@/lib/services/geo";
import { priceGroupBooking, scheduleBackToBack, type GroupPlotBill } from "@/lib/services/group-booking-rules";
import { findNearestUpazilaId } from "@/lib/services/location";
import { isServiceDue } from "@/lib/services/machine-rules";
import { createNotification } from "@/lib/services/notification";
import { getBillingQuantity, isRateAllowed } from "@/lib/services/pricing";
import { listPricedMachineTypes, type PricedMachineType } from "@/lib/services/pricing-rule";
import { findBusyMachineIdsBetween, LISTED_MACHINE } from "@/lib/services/search";
import { getPlatformFeePercent } from "@/lib/services/settings";
import { findUsableSubsidy } from "@/lib/services/subsidy";
import { DEFAULT_SEARCH_KM } from "@/lib/validators/search";
import type { GroupBookingInput } from "@/lib/validators/group-booking";
import type { ValidationKey } from "@/lib/validators/types";

// ─────────────────────────── 1. The form ───────────────────────────

/** One member the leader can add to a group booking. */
export type GroupMember = { farmerId: string; name: string; landDecimal: number };

/**
 * Everything the group booking form needs, or null if the leader has no cooperative yet:
 * the cooperative, its ACTIVE members (A to Z), the machine types with a price rule today,
 * and the form's first values (tomorrow at 8 AM, the pin on the cooperative's upazila).
 */
export async function getGroupFormData(leaderId: string) {
  const cooperative = await getLeaderCooperative(leaderId);
  if (!cooperative) {
    return null;
  }
  const [memberRows, machineTypes, platformFeePercent] = await Promise.all([
    db.cooperativeMember.findMany({
      where: { cooperativeId: cooperative.id, farmer: { status: "ACTIVE" } },
      include: { farmer: { select: { id: true, name: true, farmerProfile: { select: { landDecimal: true } } } } },
      orderBy: { farmer: { name: "asc" } },
    }),
    listPricedMachineTypes(),
    getPlatformFeePercent(),
  ]);
  const members: GroupMember[] = memberRows.map((row) => ({
    farmerId: row.farmer.id,
    name: row.farmer.name,
    landDecimal: row.farmer.farmerProfile?.landDecimal ?? 0,
  }));

  const { lat, lng } = cooperative.location;
  const pin = lat !== null && lng !== null ? { lat, lng } : BANGLADESH_CENTER;
  const defaultValues: GroupBookingInput = {
    workType: "TILLING",
    machineTypeId: "",
    day: addDays(toDhakaDay(new Date()), 1), // tomorrow
    startHour: 8,
    lat: pin.lat,
    lng: pin.lng,
    maxKm: DEFAULT_SEARCH_KM,
    plots: [],
    machineId: "",
  };
  return { cooperative, members, machineTypes, platformFeePercent, defaultValues };
}

// ─────────────────────────── Shared checks ───────────────────────────

/** One plot, ready to price and save. */
type PreparedPlot = {
  farmerId: string;
  farmerName: string;
  amount: number; // what the leader typed (decimal, hours or days)
  landDecimal: number; // saved on the booking: the plot (per acre) or the member's land
  quantity: number; // acres, hours or days to bill
  time: TimeRange; // when the machine works on this plot
  plotNote: string;
  subsidyPercent: number;
  subsidyApplicationId: string | null;
};

/** A checked group: the cooperative, the machine type and every plot with its time and subsidy. */
type PreparedGroup = {
  cooperative: { id: string; name: string; village: string; locationId: string };
  pricedType: PricedMachineType;
  plots: PreparedPlot[];
  wholeTime: TimeRange; // from the first plot's start to the last plot's end
  platformFeePercent: number;
};

/**
 * Checks a group (already checked by groupBookingSchema) against the database: the leader's
 * cooperative, every farmer a member with an active account, a priced machine type that can
 * do the work. Then works out each plot's quantity, time and the member's own subsidy.
 * Returns the prepared group, or an error key. Nothing is saved.
 */
async function prepareGroup(
  leaderId: string,
  input: GroupBookingInput,
): Promise<{ ok: true; group: PreparedGroup } | { ok: false; error: ValidationKey }> {
  const cooperative = await getLeaderCooperative(leaderId);
  if (!cooperative) {
    return { ok: false, error: "createCooperativeFirst" };
  }
  const members = await db.cooperativeMember.findMany({
    where: { cooperativeId: cooperative.id, farmerId: { in: input.plots.map((plot) => plot.farmerId) }, farmer: { status: "ACTIVE" } },
    include: { farmer: { select: { name: true, farmerProfile: { select: { landDecimal: true } } } } },
  });
  const memberById = new Map(members.map((member) => [member.farmerId, member.farmer]));
  if (memberById.size !== input.plots.length) {
    return { ok: false, error: "notAMember" };
  }

  const pricedType = (await listPricedMachineTypes()).find((type) => type.id === input.machineTypeId);
  if (!pricedType) {
    return { ok: false, error: "noPriceRule" };
  }
  if (!pricedType.workTypes.includes(input.workType)) {
    return { ok: false, error: "somethingWrong" }; // this machine type cannot do that work
  }

  const unit: BillingUnit = pricedType.billingUnit;
  const quantities = input.plots.map((plot) => getBillingQuantity(unit, plot.amount, plot.amount));
  const times = scheduleBackToBack(
    getJobStartAt(input.day, input.startHour),
    quantities.map((quantity) => estimateWorkHours(unit, quantity)),
  );
  const [subsidies, platformFeePercent] = await Promise.all([
    Promise.all(input.plots.map((plot) => findUsableSubsidy(plot.farmerId))),
    getPlatformFeePercent(),
  ]);

  const plots: PreparedPlot[] = input.plots.map((plot, index) => {
    const farmer = memberById.get(plot.farmerId)!; // checked above: every farmer is a member
    return {
      farmerId: plot.farmerId,
      farmerName: farmer.name,
      amount: plot.amount,
      // A machine rented per acre works on the plot's land; otherwise we keep the member's land size.
      landDecimal: unit === "PER_ACRE" ? plot.amount : (farmer.farmerProfile?.landDecimal ?? 0),
      quantity: quantities[index],
      time: times[index],
      plotNote: plot.plotNote,
      subsidyPercent: subsidies[index]?.discountPercent ?? 0,
      subsidyApplicationId: subsidies[index]?.applicationId ?? null,
    };
  });
  return {
    ok: true,
    group: {
      cooperative,
      pricedType,
      plots,
      wholeTime: { startAt: times[0].startAt, endAt: times[times.length - 1].endAt },
      platformFeePercent,
    },
  };
}

/** Prices every plot of a prepared group on one machine (priceGroupBooking in group-booking-rules.ts). */
function priceOnMachine(group: PreparedGroup, machine: { rate: number }, distanceKm: number) {
  return priceGroupBooking({
    rate: machine.rate,
    minCharge: group.pricedType.minCharge,
    distanceKm,
    freeKm: group.pricedType.freeKm,
    deliveryRatePerKm: group.pricedType.deliveryRatePerKm,
    platformFeePercent: group.platformFeePercent,
    plots: group.plots.map((plot) => ({ quantity: plot.quantity, subsidyPercent: plot.subsidyPercent })),
  });
}

// ─────────────────────────── 2. Finding machines ───────────────────────────

/** One plot of a machine choice: who, when, and their bill. */
export type GroupPlotPrice = {
  farmerId: string;
  farmerName: string;
  amount: number;
  startAt: Date;
  endAt: Date;
  bill: GroupPlotBill; // its work charge already holds its minimum share
};

/** One machine the leader can choose, with the price of every plot. */
export type GroupMachineChoice = {
  id: string;
  name: string;
  providerName: string;
  trustScore: number;
  rate: number;
  distanceKm: number;
  totalDeliveryCharge: number; // the one trip, before sharing
  groupTotal: number; // what all members pay together
  plots: GroupPlotPrice[];
};

export type GroupSearchResult =
  | { ok: true; choices: GroupMachineChoice[]; busyCount: number; billingUnit: BillingUnit }
  | { ok: false; error: ValidationKey };

/**
 * The machines of the chosen type that can do the whole group: listed, ready (no service due,
 * rate inside today's limit), within `maxKm` of the village pin, and free for the WHOLE time
 * from the first plot to the last. Nearest first (then the more trusted provider).
 */
export async function findGroupMachines(leaderId: string, input: GroupBookingInput): Promise<GroupSearchResult> {
  const prepared = await prepareGroup(leaderId, input);
  if (!prepared.ok) {
    return prepared;
  }
  const { group } = prepared;
  const pin = { lat: input.lat, lng: input.lng };

  const machines = await db.machine.findMany({
    where: { ...LISTED_MACHINE, machineTypeId: group.pricedType.id },
    include: { provider: { select: { name: true, providerProfile: { select: { businessName: true, trustScore: true } } } } },
  });
  const nearby = machines
    .filter((machine) => !isServiceDue(machine) && isRateAllowed(machine.rate, group.pricedType))
    .map((machine) => ({ machine, distanceKm: distanceInKm(machine, pin) }))
    .filter((candidate) => candidate.distanceKm <= input.maxKm);

  const busyIds = await findBusyMachineIdsBetween(
    nearby.map((candidate) => candidate.machine.id),
    group.wholeTime.startAt,
    group.wholeTime.endAt,
  );
  const free = nearby.filter((candidate) => !busyIds.has(candidate.machine.id));

  const choices: GroupMachineChoice[] = free.map(({ machine, distanceKm }) => {
    const price = priceOnMachine(group, machine, distanceKm);
    const profile = machine.provider.providerProfile;
    let groupTotal = 0;
    for (const bill of price.bills) {
      groupTotal += bill.totalAmount;
    }
    return {
      id: machine.id,
      name: `${machine.brand} ${machine.model}`,
      providerName: profile?.businessName ?? machine.provider.name,
      trustScore: profile?.trustScore ?? 0,
      rate: machine.rate,
      distanceKm,
      totalDeliveryCharge: price.totalDeliveryCharge,
      groupTotal,
      plots: group.plots.map((plot, index) => ({
        farmerId: plot.farmerId,
        farmerName: plot.farmerName,
        amount: plot.amount,
        startAt: plot.time.startAt,
        endAt: plot.time.endAt,
        bill: price.bills[index],
      })),
    };
  });

  // Nearest first; at the same distance, the more trusted provider first.
  choices.sort((a, b) => a.distanceKm - b.distanceKm || b.trustScore - a.trustScore);
  return { ok: true, choices, busyCount: nearby.length - free.length, billingUnit: group.pricedType.billingUnit };
}

// ─────────────────────────── 3. Booking ───────────────────────────

export type CreateGroupResult = { ok: true; groupBookingId: string } | { ok: false; error: ValidationKey };

/**
 * Books the chosen machine for every plot (see step 3 at the top of this file).
 * Returns the new GroupBooking's id, or an error key (e.g. "timeTaken" if the machine was
 * booked a moment ago by someone else).
 */
export async function createGroupBooking(
  leader: { id: string; name: string },
  input: GroupBookingInput,
): Promise<CreateGroupResult> {
  if (input.machineId === "") {
    return { ok: false, error: "chooseMachine" };
  }
  const prepared = await prepareGroup(leader.id, input);
  if (!prepared.ok) {
    return prepared;
  }
  const { group } = prepared;
  const pin = { lat: input.lat, lng: input.lng };

  // The same checks as the search, for the one machine chosen.
  const machine = await db.machine.findFirst({ where: { ...LISTED_MACHINE, id: input.machineId, machineTypeId: group.pricedType.id } });
  if (!machine || isServiceDue(machine) || !isRateAllowed(machine.rate, group.pricedType)) {
    return { ok: false, error: "machineNotAvailable" };
  }
  const distanceKm = distanceInKm(machine, pin);
  if (distanceKm > input.maxKm) {
    return { ok: false, error: "machineNotAvailable" };
  }
  const price = priceOnMachine(group, machine, distanceKm);
  const fieldUpazilaId = (await findNearestUpazilaId(pin)) ?? group.cooperative.locationId;
  const machineName = `${machine.brand} ${machine.model}`;

  return retryIfCodeTaken(async () => {
    try {
      const groupBookingId = await db.$transaction(async (tx) => {
        // 1. Lock the machine (like a single booking), so nobody else can book it at the same moment.
        await tx.$queryRaw`SELECT id FROM "Machine" WHERE id = ${machine.id} FOR UPDATE`;
        const locked = await tx.machine.findUniqueOrThrow({ where: { id: machine.id } });
        if (locked.status !== "ACTIVE" || isServiceDue(locked)) {
          throw new BookingProblem("machineNotAvailable");
        }
        // 2. The WHOLE time, from the first plot to the last, must be free.
        const clash = await findTimeClash(tx, machine.id, group.wholeTime.startAt, group.wholeTime.endAt);
        if (clash) {
          throw new BookingProblem(clash);
        }

        // 3. The group, then one normal booking per member (each gets the next booking code).
        const saved = await tx.groupBooking.create({
          data: {
            cooperativeId: group.cooperative.id,
            leaderId: leader.id,
            machineId: machine.id,
            locationId: fieldUpazilaId,
            village: group.cooperative.village,
            workType: input.workType,
            startAt: group.wholeTime.startAt,
            totalDeliveryCharge: price.totalDeliveryCharge,
          },
        });
        for (const [index, plot] of group.plots.entries()) {
          const bill = price.bills[index];
          const booking = await insertNewBooking(
            tx,
            {
              farmerId: plot.farmerId,
              machineId: machine.id,
              groupBookingId: saved.id,
              subsidyApplicationId: plot.subsidyApplicationId,
              workType: input.workType,
              landDecimal: plot.landDecimal,
              billingUnit: group.pricedType.billingUnit,
              quantity: plot.quantity,
              startAt: plot.time.startAt,
              endAt: plot.time.endAt,
              fieldLat: input.lat,
              fieldLng: input.lng,
              fieldAddress: plot.plotNote === "" ? group.cooperative.village : plot.plotNote,
              locationId: fieldUpazilaId,
              distanceKm,
              rateSnapshot: machine.rate,
              workCharge: bill.workCharge, // its own work + its minimum share
              minimumShare: bill.minimumShare, // saved, so the bill at the finish keeps it
              deliveryCharge: bill.deliveryCharge,
              subsidyAmount: bill.subsidyAmount,
              totalAmount: bill.totalAmount,
              platformFee: bill.platformFee,
            },
            leader.id, // the leader made the request for the member
            `Group booking: ${group.cooperative.name}`,
          );
          const info = { id: booking.id, code: booking.code, machineName, startAt: plot.time.startAt };
          await createNotification(
            { userId: plot.farmerId, channel: "SMS", ...groupBookedForYouMessage(info, group.cooperative.name, bill.totalAmount) },
            tx,
          );
        }

        // 4. One message to the provider for the whole group.
        await createNotification(
          {
            userId: machine.providerId,
            channel: "SMS",
            ...groupRequestMessage(machineName, group.cooperative.name, group.plots.length, group.wholeTime.startAt),
          },
          tx,
        );
        return saved.id;
      });
      return { ok: true, groupBookingId };
    } catch (error) {
      if (error instanceof BookingProblem) {
        return { ok: false, error: error.key };
      }
      throw error;
    }
  });
}

// ─────────────────────────── 4. History ───────────────────────────

/** The leader's group bookings, newest first, each with its machine and its members' bookings. */
export async function listGroupBookings(leaderId: string) {
  return db.groupBooking.findMany({
    where: { leaderId },
    include: {
      machine: { select: { brand: true, model: true, machineType: { select: { name: true, nameBn: true, icon: true } } } },
      bookings: { select: { status: true, totalAmount: true } },
    },
    orderBy: { startAt: "desc" },
  });
}

/**
 * One of the leader's OWN group bookings with everything its page shows: the machine and its
 * provider's contact, and every member's booking in the order the machine visits them.
 * The OTP codes are left out: each member sees their own codes on their own booking page.
 * Returns null for anyone else's group booking.
 */
export async function getGroupBooking(groupBookingId: string, leaderId: string) {
  return db.groupBooking.findFirst({
    where: { id: groupBookingId, leaderId },
    include: {
      cooperative: { select: { name: true } },
      machine: {
        select: {
          brand: true,
          model: true,
          machineType: { select: { name: true, nameBn: true, icon: true } },
          provider: { select: { name: true, phone: true, providerProfile: { select: { businessName: true } } } },
        },
      },
      bookings: {
        omit: { startOtp: true, finishOtp: true },
        include: { farmer: { select: { name: true, phone: true } } },
        orderBy: { startAt: "asc" },
      },
    },
  });
}
