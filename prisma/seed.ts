/**
 * Seed script — fills the database with demo data so every page has something to show.
 *
 * Run it with:   npm run db:seed
 * WARNING: it first EMPTIES every table, then adds fresh demo data.
 *
 * Demo logins (password "demo1234"): 01700000001 … 01700000008, one per role
 * (see src/lib/demo-accounts.ts). Dates are made relative to "today", so the
 * demo always has bookings for today, tomorrow, last week, and so on.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type BillingUnit,
  type BookingStatus,
  type PaymentMethod,
  type WorkType,
} from "../src/generated/prisma/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../src/lib/demo-accounts";
import { hashPassword } from "../src/lib/password";
import { distanceInKm } from "../src/lib/services/geo";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PLATFORM_FEE_PERCENT = 3;

// ─────────────────────────── Small helpers ───────────────────────────

/** A date `days` from today at `hour` o'clock Bangladesh time (UTC+6). Negative = past. */
function daysFromNow(days: number, hour = 9): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour - 6, 0, 0, 0);
  return date;
}

/** Adds hours to a date. */
function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/** A random 4-digit code like "0427" (used for start/finish OTP). */
function randomOtp(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

/** Booking code like KJ-2026-000007. */
function bookingCode(serial: number): string {
  return `KJ-2026-${String(serial).padStart(6, "0")}`;
}

/**
 * Price of a booking, following the project's pricing rules.
 * (Phase 3 moves this into src/lib/services/pricing.ts with unit tests.)
 */
function calculateSeedPrice(input: {
  quantity: number;
  rate: number;
  distanceKm: number;
  minCharge: number;
  freeKm: number;
  deliveryRatePerKm: number;
  subsidyPercent: number;
}) {
  const billedQuantity = Math.max(input.quantity, input.minCharge);
  const workCharge = Math.round(billedQuantity * input.rate);
  const deliveryCharge = Math.round(
    Math.max(0, input.distanceKm - input.freeKm) * input.deliveryRatePerKm,
  );
  const subsidyAmount = Math.round((workCharge * input.subsidyPercent) / 100);
  const totalAmount = workCharge + deliveryCharge - subsidyAmount;
  const platformFee = Math.round(((workCharge + deliveryCharge) * PLATFORM_FEE_PERCENT) / 100);
  return { workCharge, deliveryCharge, subsidyAmount, totalAmount, platformFee };
}

/** The billing quantity: acres for PER_ACRE, hours for PER_HOUR, days for PER_DAY. */
function quantityFor(unit: BillingUnit, landDecimal: number, hoursOrDays: number): number {
  if (unit === "PER_ACRE") {
    return landDecimal / 100;
  }
  return hoursOrDays;
}

/** Rough job length in hours, to set endAt. */
function jobHours(unit: BillingUnit, quantity: number): number {
  if (unit === "PER_HOUR") return quantity;
  if (unit === "PER_DAY") return quantity * 8;
  return Math.max(2, Math.ceil(quantity * 2)); // about 2 hours per acre
}

// ─────────────────────────── 1. Empty the database ───────────────────────────

/** Deletes all rows from every table (except Prisma's own migration history). */
async function emptyDatabase() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const tableList = tables.map((table) => `"${table.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

// ─────────────────────────── 2. Settings ───────────────────────────

async function seedSettings() {
  await db.setting.createMany({
    data: [
      { key: "platformFeePercent", value: "3", description: "Platform fee taken from each booking (%)" },
      { key: "cancellationFeePercent", value: "10", description: "Late cancellation fee (% of work charge)" },
      { key: "freeCancellationHours", value: "24", description: "Farmer can cancel for free until this many hours before start" },
      { key: "replacementRadiusKm", value: "15", description: "Search radius for an emergency replacement machine" },
      { key: "replacementTimeoutHours", value: "2", description: "Hours to wait for a replacement before refunding" },
    ],
  });
}

// ─────────────────────────── 3. Locations ───────────────────────────

type PlaceSeed = { name: string; nameBn: string; lat: number; lng: number };

const DIVISIONS: PlaceSeed[] = [
  { name: "Dhaka", nameBn: "ঢাকা", lat: 23.8103, lng: 90.4125 },
  { name: "Chattogram", nameBn: "চট্টগ্রাম", lat: 22.3569, lng: 91.7832 },
  { name: "Rajshahi", nameBn: "রাজশাহী", lat: 24.3745, lng: 88.6042 },
  { name: "Khulna", nameBn: "খুলনা", lat: 22.8456, lng: 89.5403 },
  { name: "Barishal", nameBn: "বরিশাল", lat: 22.701, lng: 90.3535 },
  { name: "Sylhet", nameBn: "সিলেট", lat: 24.8949, lng: 91.8687 },
  { name: "Rangpur", nameBn: "রংপুর", lat: 25.7439, lng: 89.2752 },
  { name: "Mymensingh", nameBn: "ময়মনসিংহ", lat: 24.7471, lng: 90.4203 },
];

// division -> district -> upazilas (only Rajshahi and Dhaka divisions, enough for the demo)
const DISTRICTS: { division: string; district: PlaceSeed; upazilas: PlaceSeed[] }[] = [
  {
    division: "Rajshahi",
    district: { name: "Rajshahi", nameBn: "রাজশাহী", lat: 24.3745, lng: 88.6042 },
    upazilas: [
      { name: "Paba", nameBn: "পবা", lat: 24.43, lng: 88.61 },
      { name: "Godagari", nameBn: "গোদাগাড়ী", lat: 24.4667, lng: 88.3333 },
      { name: "Tanore", nameBn: "তানোর", lat: 24.61, lng: 88.55 },
      { name: "Durgapur", nameBn: "দুর্গাপুর", lat: 24.47, lng: 88.77 },
      { name: "Puthia", nameBn: "পুঠিয়া", lat: 24.37, lng: 88.84 },
    ],
  },
  {
    division: "Rajshahi",
    district: { name: "Bogura", nameBn: "বগুড়া", lat: 24.8466, lng: 89.3776 },
    upazilas: [
      { name: "Sherpur", nameBn: "শেরপুর", lat: 24.6667, lng: 89.4167 },
      { name: "Gabtali", nameBn: "গাবতলী", lat: 24.8833, lng: 89.45 },
    ],
  },
  {
    division: "Rajshahi",
    district: { name: "Naogaon", nameBn: "নওগাঁ", lat: 24.809, lng: 88.948 },
    upazilas: [
      { name: "Niamatpur", nameBn: "নিয়ামতপুর", lat: 24.8333, lng: 88.55 },
      { name: "Manda", nameBn: "মান্দা", lat: 24.7667, lng: 88.6833 },
    ],
  },
  {
    division: "Rajshahi",
    district: { name: "Chapainawabganj", nameBn: "চাঁপাইনবাবগঞ্জ", lat: 24.5965, lng: 88.2776 },
    upazilas: [{ name: "Shibganj", nameBn: "শিবগঞ্জ", lat: 24.6833, lng: 88.1667 }],
  },
  {
    division: "Dhaka",
    district: { name: "Dhaka", nameBn: "ঢাকা", lat: 23.8103, lng: 90.4125 },
    upazilas: [
      { name: "Savar", nameBn: "সাভার", lat: 23.8583, lng: 90.2667 },
      { name: "Dhamrai", nameBn: "ধামরাই", lat: 23.9167, lng: 90.2167 },
    ],
  },
  {
    division: "Dhaka",
    district: { name: "Gazipur", nameBn: "গাজীপুর", lat: 24.0023, lng: 90.4264 },
    upazilas: [
      { name: "Kapasia", nameBn: "কাপাসিয়া", lat: 24.1, lng: 90.5667 },
      { name: "Sreepur", nameBn: "শ্রীপুর", lat: 24.2, lng: 90.4833 },
    ],
  },
  {
    division: "Dhaka",
    district: { name: "Tangail", nameBn: "টাঙ্গাইল", lat: 24.2513, lng: 89.9167 },
    upazilas: [
      { name: "Madhupur", nameBn: "মধুপুর", lat: 24.6167, lng: 90.0333 },
      { name: "Mirzapur", nameBn: "মির্জাপুর", lat: 24.1, lng: 90.1 },
    ],
  },
  {
    division: "Dhaka",
    district: { name: "Manikganj", nameBn: "মানিকগঞ্জ", lat: 23.8617, lng: 90.0003 },
    upazilas: [{ name: "Singair", nameBn: "সিঙ্গাইর", lat: 23.8167, lng: 90.15 }],
  },
];

// A few unions, to show the last level of the tree.
const UNIONS: { upazila: string; union: PlaceSeed }[] = [
  { upazila: "Paba", union: { name: "Haripur", nameBn: "হরিপুর", lat: 24.45, lng: 88.62 } },
  { upazila: "Paba", union: { name: "Parila", nameBn: "পারিলা", lat: 24.41, lng: 88.66 } },
  { upazila: "Paba", union: { name: "Damkura", nameBn: "দামকুড়া", lat: 24.47, lng: 88.57 } },
  { upazila: "Godagari", union: { name: "Mohanpur", nameBn: "মোহনপুর", lat: 24.49, lng: 88.36 } },
  { upazila: "Godagari", union: { name: "Rishikul", nameBn: "ঋষিকুল", lat: 24.45, lng: 88.4 } },
];

/** Creates all locations. Returns the upazilas by English name (id + centre point). */
async function seedLocations() {
  const divisionIds = new Map<string, string>();
  for (const division of DIVISIONS) {
    const row = await db.location.create({ data: { ...division, level: "DIVISION" } });
    divisionIds.set(division.name, row.id);
  }

  const upazilas = new Map<string, { id: string; lat: number; lng: number }>();
  for (const item of DISTRICTS) {
    const district = await db.location.create({
      data: { ...item.district, level: "DISTRICT", parentId: divisionIds.get(item.division) },
    });
    for (const upazila of item.upazilas) {
      const row = await db.location.create({
        data: { ...upazila, level: "UPAZILA", parentId: district.id },
      });
      upazilas.set(upazila.name, { id: row.id, lat: upazila.lat, lng: upazila.lng });
    }
  }

  for (const item of UNIONS) {
    await db.location.create({
      data: { ...item.union, level: "UNION", parentId: upazilas.get(item.upazila)?.id },
    });
  }
  return upazilas;
}

// ─────────────────────────── 4. Machine types, prices, subsidy ───────────────────────────

type MachineTypeSeed = {
  name: string;
  nameBn: string;
  category: "LAND_PREPARATION" | "PLANTING" | "HARVESTING" | "IRRIGATION" | "CROP_CARE";
  workTypes: WorkType[];
  billingUnit: BillingUnit;
  icon: string;
  // price rule
  minRate: number;
  maxRate: number;
  seasonCapPercent: number;
  harvestSeason: boolean;
  deliveryRatePerKm: number;
  minCharge: number;
};

const MACHINE_TYPES: MachineTypeSeed[] = [
  { name: "Tractor", nameBn: "ট্রাক্টর", category: "LAND_PREPARATION", workTypes: ["TILLING"], billingUnit: "PER_ACRE", icon: "Tractor", minRate: 2000, maxRate: 3000, seasonCapPercent: 10, harvestSeason: false, deliveryRatePerKm: 50, minCharge: 0.5 },
  { name: "Power Tiller", nameBn: "পাওয়ার টিলার", category: "LAND_PREPARATION", workTypes: ["TILLING"], billingUnit: "PER_ACRE", icon: "Shovel", minRate: 1200, maxRate: 1800, seasonCapPercent: 10, harvestSeason: false, deliveryRatePerKm: 40, minCharge: 0.25 },
  { name: "Combine Harvester", nameBn: "কম্বাইন হারভেস্টার", category: "HARVESTING", workTypes: ["HARVESTING"], billingUnit: "PER_ACRE", icon: "Wheat", minRate: 2400, maxRate: 3500, seasonCapPercent: 15, harvestSeason: true, deliveryRatePerKm: 60, minCharge: 1 },
  { name: "Reaper", nameBn: "রিপার", category: "HARVESTING", workTypes: ["HARVESTING"], billingUnit: "PER_ACRE", icon: "Scissors", minRate: 1500, maxRate: 2200, seasonCapPercent: 15, harvestSeason: true, deliveryRatePerKm: 40, minCharge: 0.5 },
  { name: "Rice Transplanter", nameBn: "রাইস ট্রান্সপ্লান্টার", category: "PLANTING", workTypes: ["TRANSPLANTING"], billingUnit: "PER_ACRE", icon: "Sprout", minRate: 1800, maxRate: 2600, seasonCapPercent: 0, harvestSeason: false, deliveryRatePerKm: 50, minCharge: 0.5 },
  { name: "Irrigation Pump", nameBn: "সেচ পাম্প", category: "IRRIGATION", workTypes: ["IRRIGATION"], billingUnit: "PER_HOUR", icon: "Droplets", minRate: 150, maxRate: 250, seasonCapPercent: 0, harvestSeason: false, deliveryRatePerKm: 30, minCharge: 2 },
  { name: "Seeder", nameBn: "বীজ বপন যন্ত্র", category: "PLANTING", workTypes: ["SEEDING"], billingUnit: "PER_ACRE", icon: "Leaf", minRate: 1000, maxRate: 1500, seasonCapPercent: 0, harvestSeason: false, deliveryRatePerKm: 40, minCharge: 0.5 },
  { name: "Sprayer", nameBn: "স্প্রে মেশিন", category: "CROP_CARE", workTypes: ["SPRAYING"], billingUnit: "PER_DAY", icon: "SprayCan", minRate: 500, maxRate: 900, seasonCapPercent: 0, harvestSeason: false, deliveryRatePerKm: 30, minCharge: 1 },
];

type PriceRuleInfo = {
  machineTypeId: string;
  billingUnit: BillingUnit;
  freeKm: number;
  deliveryRatePerKm: number;
  minCharge: number;
};

/** Creates the machine types and one government price rule for each. Returns rules by type name. */
async function seedMachineTypesAndPrices() {
  const rules = new Map<string, PriceRuleInfo>();
  let sortOrder = 1;
  for (const type of MACHINE_TYPES) {
    const machineType = await db.machineType.create({
      data: {
        name: type.name,
        nameBn: type.nameBn,
        category: type.category,
        workTypes: type.workTypes,
        billingUnit: type.billingUnit,
        icon: type.icon,
        sortOrder: sortOrder++,
      },
    });
    await db.pricingRule.create({
      data: {
        machineTypeId: machineType.id,
        billingUnit: type.billingUnit,
        minRate: type.minRate,
        maxRate: type.maxRate,
        seasonCapPercent: type.seasonCapPercent,
        // Aman rice harvest season (November – December)
        harvestSeasonStart: type.harvestSeason ? new Date("2026-11-01T00:00:00+06:00") : null,
        harvestSeasonEnd: type.harvestSeason ? new Date("2026-12-31T23:59:59+06:00") : null,
        deliveryRatePerKm: type.deliveryRatePerKm,
        freeKm: 3,
        minCharge: type.minCharge,
        activeFrom: new Date("2026-01-01T00:00:00+06:00"),
      },
    });
    rules.set(type.name, {
      machineTypeId: machineType.id,
      billingUnit: type.billingUnit,
      freeKm: 3,
      deliveryRatePerKm: type.deliveryRatePerKm,
      minCharge: type.minCharge,
    });
  }
  return rules;
}

async function seedSubsidyProgram() {
  return db.subsidyProgram.create({
    data: {
      name: "Small Farmer Mechanization Support 2026",
      nameBn: "ক্ষুদ্র কৃষক যান্ত্রিকীকরণ সহায়তা ২০২৬",
      description: "20% off the work charge for verified farmers with 200 decimal of land or less.",
      discountPercent: 20,
      maxLandDecimal: 200,
      budget: 500000,
      startAt: new Date("2026-07-01T00:00:00+06:00"),
      endAt: new Date("2027-06-30T23:59:59+06:00"),
    },
  });
}

// ─────────────────────────── 5. Users ───────────────────────────

type Upazilas = Awaited<ReturnType<typeof seedLocations>>;

/** Creates all demo users with their profiles. Returns the ids we need later. */
async function seedUsers(upazilas: Upazilas, passwordHash: string) {
  const upazilaId = (name: string) => upazilas.get(name)!.id;
  const demoPhone = (role: string) => DEMO_ACCOUNTS.find((account) => account.role === role)!;

  // The 8 demo users, one per role
  const demoFarmer = await db.user.create({
    data: {
      ...demoPhone("FARMER"),
      passwordHash,
      farmerProfile: {
        create: {
          nid: "1990817123456",
          landDecimal: 150,
          village: "Haripur",
          locationId: upazilaId("Paba"),
          verificationStatus: "VERIFIED",
          verifiedAt: daysFromNow(-60),
        },
      },
    },
  });
  const coopLeader = await db.user.create({ data: { ...demoPhone("COOP_LEADER"), passwordHash } });
  const demoProvider = await db.user.create({
    data: {
      ...demoPhone("PROVIDER"),
      passwordHash,
      providerProfile: {
        create: {
          providerType: "INDIVIDUAL",
          businessName: "Jamal Krishi Seba",
          nid: "1985817654321",
          address: "Naohata Bazar, Paba",
          locationId: upazilaId("Paba"),
          approvalStatus: "APPROVED",
          approvedAt: daysFromNow(-90),
          trustScore: 88,
          payoutAccount: "bKash 01700000003",
        },
      },
    },
  });
  const demoOperator = await db.user.create({
    data: {
      ...demoPhone("OPERATOR"),
      passwordHash,
      operatorProfile: {
        create: {
          providerId: demoProvider.id,
          licenseNo: "RAJ-DL-0045123",
          experienceYears: 6,
          approvalStatus: "APPROVED",
        },
      },
    },
  });
  const demoTechnician = await db.user.create({
    data: {
      ...demoPhone("TECHNICIAN"),
      passwordHash,
      technicianProfile: {
        create: { skills: "Diesel engine, hydraulics, pumps", locationId: upazilaId("Paba") },
      },
    },
  });
  const demoOfficer = await db.user.create({
    data: {
      ...demoPhone("OFFICER"),
      passwordHash,
      officerProfile: {
        create: { upazilaId: upazilaId("Paba"), designation: "Upazila Agriculture Officer" },
      },
    },
  });
  const govtUser = await db.user.create({ data: { ...demoPhone("GOVT"), passwordHash } });
  const admin = await db.user.create({ data: { ...demoPhone("ADMIN"), passwordHash } });

  // The demo officer is the one who verified the demo farmer
  await db.farmerProfile.update({
    where: { userId: demoFarmer.id },
    data: { verifiedById: demoOfficer.id },
  });

  // 10 more farmers
  const farmerSeeds = [
    { name: "Mizanur Rahman", upazila: "Paba", village: "Parila", land: 90, status: "VERIFIED" },
    { name: "Shafiqul Islam", upazila: "Paba", village: "Damkura", land: 180, status: "PENDING" },
    { name: "Rokeya Begum", upazila: "Paba", village: "Haripur", land: 45, status: "VERIFIED" },
    { name: "Abul Kalam", upazila: "Godagari", village: "Mohanpur", land: 320, status: "VERIFIED" },
    { name: "Nurul Amin", upazila: "Tanore", village: "Kalma", land: 120, status: "PENDING" },
    { name: "Fatema Khatun", upazila: "Godagari", village: "Rishikul", land: 66, status: "VERIFIED" },
    { name: "Aminul Haque", upazila: "Durgapur", village: "Jhaluka", land: 210, status: "REJECTED" },
    { name: "Shahida Parvin", upazila: "Savar", village: "Tetuljhora", land: 75, status: "VERIFIED" },
    { name: "Delwar Hossain", upazila: "Dhamrai", village: "Kushura", land: 140, status: "PENDING" },
    { name: "Mosharraf Ali", upazila: "Kapasia", village: "Toke", land: 99, status: "VERIFIED" },
  ] as const;

  const farmers = [];
  for (const [index, farmer] of farmerSeeds.entries()) {
    const user = await db.user.create({
      data: {
        name: farmer.name,
        phone: `017100000${String(index + 1).padStart(2, "0")}`,
        passwordHash,
        role: "FARMER",
        // One suspended farmer, so admin can practise "activate"
        status: index === 6 ? "SUSPENDED" : "ACTIVE",
        farmerProfile: {
          create: {
            nid: `19${80 + index}81712${String(3000 + index)}`,
            landDecimal: farmer.land,
            village: farmer.village,
            locationId: upazilaId(farmer.upazila),
            verificationStatus: farmer.status,
            verifiedById: farmer.status === "PENDING" ? null : demoOfficer.id,
            verifiedAt: farmer.status === "PENDING" ? null : daysFromNow(-30),
          },
        },
      },
    });
    farmers.push({ ...user, upazila: farmer.upazila });
  }

  // 4 more providers (the last one still waits for admin approval)
  const providerSeeds = [
    { name: "Shahidul Haque", type: "COMPANY", business: "Barind Agro Services Ltd.", upazila: "Godagari", approval: "APPROVED", trust: 92 },
    { name: "Moinul Hossain", type: "COOPERATIVE", business: "Tanore Krishok Samabay Samity", upazila: "Tanore", approval: "APPROVED", trust: 75 },
    { name: "Kamrul Hasan", type: "INDIVIDUAL", business: "Kamrul Tractor House", upazila: "Savar", approval: "APPROVED", trust: 85 },
    { name: "Ayesha Siddika", type: "INDIVIDUAL", business: "Ayesha Krishi Jontro", upazila: "Kapasia", approval: "PENDING", trust: 80 },
  ] as const;

  const providers = [];
  for (const [index, provider] of providerSeeds.entries()) {
    const user = await db.user.create({
      data: {
        name: provider.name,
        phone: `017200000${String(index + 1).padStart(2, "0")}`,
        passwordHash,
        role: "PROVIDER",
        providerProfile: {
          create: {
            providerType: provider.type,
            businessName: provider.business,
            locationId: upazilaId(provider.upazila),
            approvalStatus: provider.approval,
            approvedAt: provider.approval === "APPROVED" ? daysFromNow(-80) : null,
            trustScore: provider.trust,
            payoutAccount: `bKash 017200000${String(index + 1).padStart(2, "0")}`,
          },
        },
      },
    });
    providers.push(user);
  }
  const [barindProvider, tanoreProvider, kamrulProvider, ayeshaProvider] = providers;

  // 6 more operators, each working for one provider
  const operatorSeeds = [
    { name: "Rubel Hossain", providerId: barindProvider.id, years: 8, approval: "APPROVED" },
    { name: "Sumon Ali", providerId: barindProvider.id, years: 4, approval: "APPROVED" },
    { name: "Liton Sarker", providerId: tanoreProvider.id, years: 5, approval: "APPROVED" },
    { name: "Babul Mia", providerId: kamrulProvider.id, years: 10, approval: "APPROVED" },
    { name: "Shamim Reza", providerId: demoProvider.id, years: 3, approval: "APPROVED" },
    { name: "Arif Hasan", providerId: ayeshaProvider.id, years: 2, approval: "PENDING" },
  ] as const;

  const operators = [];
  for (const [index, operator] of operatorSeeds.entries()) {
    const user = await db.user.create({
      data: {
        name: operator.name,
        phone: `017300000${String(index + 1).padStart(2, "0")}`,
        passwordHash,
        role: "OPERATOR",
        operatorProfile: {
          create: {
            providerId: operator.providerId,
            experienceYears: operator.years,
            approvalStatus: operator.approval,
          },
        },
      },
    });
    operators.push(user);
  }

  return {
    demoFarmer,
    coopLeader,
    demoProvider,
    demoOperator,
    demoTechnician,
    demoOfficer,
    govtUser,
    admin,
    farmers,
    barindProvider,
    tanoreProvider,
    kamrulProvider,
    ayeshaProvider,
    operators,
  };
}

// ─────────────────────────── 6. Machines ───────────────────────────

type Users = Awaited<ReturnType<typeof seedUsers>>;
type Rules = Awaited<ReturnType<typeof seedMachineTypesAndPrices>>;

/** Creates 15 machines. Returns them by a short key, e.g. "jamalTractor". */
async function seedMachines(upazilas: Upazilas, rules: Rules, users: Users) {
  const machineSeeds = [
    { key: "jamalTractor", provider: users.demoProvider.id, type: "Tractor", brand: "Mahindra", model: "575 DI", year: 2021, hp: 47, rate: 2400, upazila: "Paba", hours: 820, due: 1000, reg: "RAJ-TR-1001" },
    { key: "jamalTiller", provider: users.demoProvider.id, type: "Power Tiller", brand: "Dongfeng", model: "DF-12L", year: 2020, hp: 12, rate: 1500, upazila: "Paba", hours: 410, due: 500, reg: "RAJ-PT-1002" },
    { key: "jamalPump", provider: users.demoProvider.id, type: "Irrigation Pump", brand: "Kirloskar", model: "KDS 5", year: 2019, hp: 5, rate: 200, upazila: "Paba", hours: 1300, due: 1500, reg: null },
    { key: "barindCombine1", provider: users.barindProvider.id, type: "Combine Harvester", brand: "Kubota", model: "DC-70G", year: 2022, hp: 70, rate: 3000, upazila: "Godagari", hours: 1480, due: 1500, reg: "RAJ-CH-2001" },
    { key: "barindCombine2", provider: users.barindProvider.id, type: "Combine Harvester", brand: "Yanmar", model: "AW70", year: 2021, hp: 70, rate: 3200, upazila: "Godagari", hours: 900, due: 1500, reg: "RAJ-CH-2002" },
    { key: "barindReaper", provider: users.barindProvider.id, type: "Reaper", brand: "KAMCO", model: "KR-120", year: 2020, hp: 6, rate: 1800, upazila: "Godagari", hours: 300, due: 500, reg: null },
    { key: "barindTransplanter", provider: users.barindProvider.id, type: "Rice Transplanter", brand: "Kubota", model: "NSP-4W", year: 2022, hp: 4, rate: 2200, upazila: "Godagari", hours: 220, due: 500, reg: null },
    { key: "barindTractor", provider: users.barindProvider.id, type: "Tractor", brand: "Sonalika", model: "DI 750", year: 2019, hp: 55, rate: 2800, upazila: "Godagari", hours: 1960, due: 2000, reg: "RAJ-TR-2003", status: "UNDER_MAINTENANCE" },
    { key: "tanoreTiller", provider: users.tanoreProvider.id, type: "Power Tiller", brand: "Dongfeng", model: "DF-15L", year: 2021, hp: 15, rate: 1400, upazila: "Tanore", hours: 380, due: 500, reg: "RAJ-PT-3001" },
    { key: "tanoreSeeder", provider: users.tanoreProvider.id, type: "Seeder", brand: "BARI", model: "Inclined Plate Seeder", year: 2022, hp: 12, rate: 1200, upazila: "Tanore", hours: 90, due: 300, reg: null, approval: "PENDING" },
    { key: "tanorePump", provider: users.tanoreProvider.id, type: "Irrigation Pump", brand: "Lister", model: "8HP", year: 2018, hp: 8, rate: 180, upazila: "Tanore", hours: 2010, due: 2000, reg: null },
    { key: "kamrulTractor", provider: users.kamrulProvider.id, type: "Tractor", brand: "Massey Ferguson", model: "260", year: 2020, hp: 60, rate: 2600, upazila: "Savar", hours: 700, due: 1000, reg: "DHA-TR-4001" },
    { key: "kamrulSprayer", provider: users.kamrulProvider.id, type: "Sprayer", brand: "Aspee", model: "Power Sprayer", year: 2023, hp: 2, rate: 700, upazila: "Savar", hours: 60, due: 300, reg: null },
    { key: "kamrulReaper", provider: users.kamrulProvider.id, type: "Reaper", brand: "BCS", model: "622", year: 2021, hp: 7, rate: 1700, upazila: "Dhamrai", hours: 250, due: 500, reg: null },
    { key: "ayeshaTiller", provider: users.ayeshaProvider.id, type: "Power Tiller", brand: "Saifeng", model: "12HP", year: 2022, hp: 12, rate: 1300, upazila: "Kapasia", hours: 150, due: 500, reg: null, approval: "PENDING" },
  ];

  const machines = new Map<string, { id: string; rate: number; type: string; lat: number; lng: number; locationId: string; providerId: string }>();
  for (const [index, seed] of machineSeeds.entries()) {
    const place = upazilas.get(seed.upazila)!;
    // Spread machines a little around the upazila centre, so map pins don't sit on top of each other
    const lat = place.lat + (index % 3) * 0.004;
    const lng = place.lng + (index % 2) * 0.004;
    const machine = await db.machine.create({
      data: {
        providerId: seed.provider,
        machineTypeId: rules.get(seed.type)!.machineTypeId,
        brand: seed.brand,
        model: seed.model,
        year: seed.year,
        horsePower: seed.hp,
        registrationNo: seed.reg,
        description: `${seed.brand} ${seed.model}, well maintained, with trained operator.`,
        rate: seed.rate,
        locationId: place.id,
        lat,
        lng,
        approvalStatus: seed.approval === "PENDING" ? "PENDING" : "APPROVED",
        status: seed.status === "UNDER_MAINTENANCE" ? "UNDER_MAINTENANCE" : "ACTIVE",
        engineHours: seed.hours,
        serviceDueHours: seed.due,
      },
    });
    machines.set(seed.key, {
      id: machine.id,
      rate: seed.rate,
      type: seed.type,
      lat,
      lng,
      locationId: place.id,
      providerId: seed.provider,
    });
  }

  // Days when two machines are not available (blocked by their owners)
  await db.availabilityBlock.createMany({
    data: [
      { machineId: machines.get("jamalTractor")!.id, startAt: daysFromNow(15, 0), endAt: daysFromNow(17, 0), reason: "Family program" },
      { machineId: machines.get("kamrulTractor")!.id, startAt: daysFromNow(8, 0), endAt: daysFromNow(9, 0), reason: "Own land work" },
    ],
  });
  return machines;
}

// ─────────────────────────── 7. Bookings ───────────────────────────

/** The status steps a booking walks through to reach each final status. */
const STATUS_PATHS: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ["REQUESTED"],
  ACCEPTED: ["REQUESTED", "ACCEPTED"],
  REJECTED: ["REQUESTED", "REJECTED"],
  CANCELLED: ["REQUESTED", "ACCEPTED", "CANCELLED"],
  OPERATOR_ASSIGNED: ["REQUESTED", "ACCEPTED", "OPERATOR_ASSIGNED"],
  ON_THE_WAY: ["REQUESTED", "ACCEPTED", "OPERATOR_ASSIGNED", "ON_THE_WAY"],
  WORKING: ["REQUESTED", "ACCEPTED", "OPERATOR_ASSIGNED", "ON_THE_WAY", "WORKING"],
  BREAKDOWN: ["REQUESTED", "ACCEPTED", "OPERATOR_ASSIGNED", "ON_THE_WAY", "WORKING", "BREAKDOWN"],
  COMPLETED: ["REQUESTED", "ACCEPTED", "OPERATOR_ASSIGNED", "ON_THE_WAY", "WORKING", "COMPLETED"],
  PAID: ["REQUESTED", "ACCEPTED", "OPERATOR_ASSIGNED", "ON_THE_WAY", "WORKING", "COMPLETED", "PAID"],
  REVIEWED: ["REQUESTED", "ACCEPTED", "OPERATOR_ASSIGNED", "ON_THE_WAY", "WORKING", "COMPLETED", "PAID", "REVIEWED"],
  DISPUTED: ["REQUESTED", "ACCEPTED", "OPERATOR_ASSIGNED", "ON_THE_WAY", "WORKING", "COMPLETED", "DISPUTED"],
};

type BookingSeed = {
  status: BookingStatus;
  farmerId: string;
  machineKey: string;
  operatorId?: string;
  startDay?: number; // days from today (negative = in the past)...
  startHour?: number; // ...at this hour
  startInHours?: number; // OR: hours from right now (for jobs happening today)
  landDecimal: number;
  hoursOrDays?: number; // for PER_HOUR / PER_DAY machines
  fieldOffsetKm: number; // how far north of the machine the field is
  subsidyApplicationId?: string;
  paymentMethod?: PaymentMethod;
  fieldAddress: string;
};

type Machines = Awaited<ReturnType<typeof seedMachines>>;

/** Creates one booking with its status history, payment and reviews. Returns the booking id. */
async function createSeedBooking(
  serial: number,
  seed: BookingSeed,
  machines: Machines,
  rules: Rules,
  actors: { providerId: string },
) {
  const machine = machines.get(seed.machineKey)!;
  const rule = rules.get(machine.type)!;

  // Put the field `fieldOffsetKm` north of the machine (1 km ≈ 0.008993° of latitude).
  const fieldLat = machine.lat + seed.fieldOffsetKm * 0.008993;
  const fieldLng = machine.lng;
  const distanceKm = distanceInKm({ lat: machine.lat, lng: machine.lng }, { lat: fieldLat, lng: fieldLng });

  const quantity = quantityFor(rule.billingUnit, seed.landDecimal, seed.hoursOrDays ?? 1);
  const price = calculateSeedPrice({
    quantity,
    rate: machine.rate,
    distanceKm,
    minCharge: rule.minCharge,
    freeKm: rule.freeKm,
    deliveryRatePerKm: rule.deliveryRatePerKm,
    subsidyPercent: seed.subsidyApplicationId ? 20 : 0,
  });

  const startAt =
    seed.startInHours !== undefined
      ? addHours(new Date(), seed.startInHours)
      : daysFromNow(seed.startDay ?? 0, seed.startHour ?? 9);
  const endAt = addHours(startAt, jobHours(rule.billingUnit, quantity));
  // Booked 3 days before the start, but never in the future
  const createdAt = new Date(Math.min(addHours(startAt, -72).getTime(), addHours(new Date(), -3).getTime()));
  const path = STATUS_PATHS[seed.status];
  const wasAccepted = path.includes("ACCEPTED");
  const workStarted = path.includes("WORKING");
  const workFinished = path.includes("COMPLETED");

  const booking = await db.booking.create({
    data: {
      code: bookingCode(serial),
      farmerId: seed.farmerId,
      machineId: machine.id,
      operatorId: path.includes("OPERATOR_ASSIGNED") ? seed.operatorId : null,
      subsidyApplicationId: seed.subsidyApplicationId ?? null,
      workType: MACHINE_TYPES.find((type) => type.name === machine.type)!.workTypes[0],
      landDecimal: seed.landDecimal,
      billingUnit: rule.billingUnit,
      quantity,
      startAt,
      endAt,
      fieldLat,
      fieldLng,
      fieldAddress: seed.fieldAddress,
      locationId: machine.locationId,
      distanceKm,
      rateSnapshot: machine.rate,
      ...price,
      startOtp: wasAccepted ? randomOtp() : null,
      finishOtp: wasAccepted ? randomOtp() : null,
      actualQuantity: workFinished ? quantity : null,
      status: seed.status,
      startedAt: workStarted ? startAt : null,
      completedAt: workFinished ? endAt : null,
      createdAt,
    },
  });

  // Status history: one log row for each step, at a sensible time, done by the right person.
  const timeFor = (status: BookingStatus): Date => {
    if (status === "REQUESTED") return createdAt;
    if (status === "ACCEPTED" || status === "REJECTED") return addHours(createdAt, 1);
    if (status === "OPERATOR_ASSIGNED" || status === "CANCELLED") return addHours(createdAt, 2);
    if (status === "ON_THE_WAY") return addHours(startAt, -1);
    if (status === "WORKING") return startAt;
    if (status === "BREAKDOWN") return addHours(startAt, 1);
    if (status === "COMPLETED") return endAt;
    if (status === "PAID") return addHours(endAt, 1);
    if (status === "DISPUTED") return addHours(endAt, 2);
    return addHours(endAt, 3); // REVIEWED
  };
  const actorFor = (status: BookingStatus): string | undefined => {
    if (["ACCEPTED", "REJECTED", "OPERATOR_ASSIGNED"].includes(status)) return actors.providerId;
    if (["ON_THE_WAY", "WORKING", "COMPLETED", "BREAKDOWN"].includes(status)) return seed.operatorId;
    return seed.farmerId; // REQUESTED, CANCELLED, PAID, REVIEWED, DISPUTED
  };
  await db.bookingStatusLog.createMany({
    data: path.map((status, index) => ({
      bookingId: booking.id,
      fromStatus: index === 0 ? null : path[index - 1],
      toStatus: status,
      actorId: actorFor(status),
      createdAt: timeFor(status),
    })),
  });

  // Payment for bookings that reached PAID
  if (path.includes("PAID")) {
    await db.payment.create({
      data: {
        bookingId: booking.id,
        payerId: seed.farmerId,
        amount: price.totalAmount,
        method: seed.paymentMethod ?? "MOCK",
        status: "SUCCESS",
        transactionId: `TXN-${booking.code}`,
        gatewayRef: seed.paymentMethod === "CASH" ? null : `VAL-${serial}${Date.now() % 100000}`,
        paidAt: addHours(endAt, 1),
      },
    });
  }

  // Two separate reviews (machine + operator) for REVIEWED bookings
  if (seed.status === "REVIEWED" && seed.operatorId) {
    await db.review.createMany({
      data: [
        { bookingId: booking.id, reviewerId: seed.farmerId, target: "MACHINE", machineId: machine.id, rating: 5, comment: "Machine worked very well." },
        { bookingId: booking.id, reviewerId: seed.farmerId, target: "OPERATOR", machineId: machine.id, operatorId: seed.operatorId, rating: 4, comment: "Good driver, came a little late." },
      ],
    });
  }

  return { id: booking.id, code: booking.code, ...price };
}

async function seedBookings(users: Users, machines: Machines, rules: Rules, subsidyApplicationId: string) {
  const [f1, f2, f3, f4, f5, f6, , f8, f9] = users.farmers;
  const [rubel, sumon, liton, babul, shamim] = users.operators;
  const jamal = { providerId: users.demoProvider.id };
  const barind = { providerId: users.barindProvider.id };
  const tanore = { providerId: users.tanoreProvider.id };
  const kamrul = { providerId: users.kamrulProvider.id };

  // One booking in every status. Booking 1 is the worked price example from the project brief:
  // 66 decimal, rate 2400/acre, 8 km, 3 free km, 50 Tk/km, 20% subsidy
  // -> work 1584, delivery 250, subsidy 317, farmer pays 1517, fee 55.
  const plan: [BookingSeed, { providerId: string }][] = [
    [{ status: "REQUESTED", farmerId: users.demoFarmer.id, machineKey: "jamalTractor", startDay: 5, landDecimal: 66, fieldOffsetKm: 8, subsidyApplicationId, fieldAddress: "Haripur north field" }, jamal],
    [{ status: "ACCEPTED", farmerId: f1.id, machineKey: "jamalTiller", operatorId: shamim.id, startDay: 3, landDecimal: 40, fieldOffsetKm: 2, fieldAddress: "Parila, near school" }, jamal],
    [{ status: "REJECTED", farmerId: f2.id, machineKey: "barindCombine1", startDay: -2, landDecimal: 150, fieldOffsetKm: 12, fieldAddress: "Damkura east" }, barind],
    [{ status: "CANCELLED", farmerId: f3.id, machineKey: "kamrulTractor", startDay: 4, landDecimal: 50, fieldOffsetKm: 5, fieldAddress: "Haripur pond side" }, kamrul],
    [{ status: "OPERATOR_ASSIGNED", farmerId: f4.id, machineKey: "barindReaper", operatorId: sumon.id, startDay: 1, landDecimal: 120, fieldOffsetKm: 4, fieldAddress: "Mohanpur bil" }, barind],
    [{ status: "ON_THE_WAY", farmerId: users.demoFarmer.id, machineKey: "jamalPump", operatorId: users.demoOperator.id, startInHours: 1, landDecimal: 100, hoursOrDays: 6, fieldOffsetKm: 3.5, fieldAddress: "Haripur south field" }, jamal],
    [{ status: "WORKING", farmerId: f6.id, machineKey: "barindCombine2", operatorId: rubel.id, startInHours: -1, landDecimal: 132, fieldOffsetKm: 6, fieldAddress: "Rishikul plot 4" }, barind],
    [{ status: "BREAKDOWN", farmerId: f5.id, machineKey: "tanoreTiller", operatorId: liton.id, startInHours: -2, landDecimal: 99, fieldOffsetKm: 2.5, fieldAddress: "Kalma village" }, tanore],
    [{ status: "COMPLETED", farmerId: f8.id, machineKey: "kamrulTractor", operatorId: babul.id, startDay: -1, landDecimal: 75, fieldOffsetKm: 3, fieldAddress: "Tetuljhora" }, kamrul],
    [{ status: "PAID", farmerId: users.demoFarmer.id, machineKey: "jamalTiller", operatorId: users.demoOperator.id, startDay: -10, landDecimal: 50, fieldOffsetKm: 4, subsidyApplicationId, paymentMethod: "CASH", fieldAddress: "Haripur north field" }, jamal],
    [{ status: "REVIEWED", farmerId: users.demoFarmer.id, machineKey: "jamalTractor", operatorId: users.demoOperator.id, startDay: -20, landDecimal: 100, fieldOffsetKm: 5, subsidyApplicationId, paymentMethod: "SSLCOMMERZ", fieldAddress: "Haripur south field" }, jamal],
    [{ status: "DISPUTED", farmerId: f9.id, machineKey: "barindTransplanter", operatorId: sumon.id, startDay: -7, landDecimal: 80, fieldOffsetKm: 7, fieldAddress: "Kushura" }, barind],
  ];

  // Extra finished bookings over the last 3 months, so dashboards and charts have data.
  const history: [BookingSeed, { providerId: string }][] = [
    [{ status: "REVIEWED", farmerId: f1.id, machineKey: "jamalTractor", operatorId: shamim.id, startDay: -75, landDecimal: 90, fieldOffsetKm: 2, paymentMethod: "MOCK", fieldAddress: "Parila" }, jamal],
    [{ status: "REVIEWED", farmerId: f4.id, machineKey: "barindCombine1", operatorId: rubel.id, startDay: -60, landDecimal: 320, fieldOffsetKm: 5, paymentMethod: "SSLCOMMERZ", fieldAddress: "Mohanpur" }, barind],
    [{ status: "PAID", farmerId: f6.id, machineKey: "barindCombine2", operatorId: rubel.id, startDay: -55, landDecimal: 66, fieldOffsetKm: 6, paymentMethod: "CASH", fieldAddress: "Rishikul" }, barind],
    [{ status: "REVIEWED", farmerId: f8.id, machineKey: "kamrulSprayer", operatorId: babul.id, startDay: -45, landDecimal: 75, hoursOrDays: 1, fieldOffsetKm: 2, paymentMethod: "MOCK", fieldAddress: "Tetuljhora" }, kamrul],
    [{ status: "PAID", farmerId: f3.id, machineKey: "jamalPump", operatorId: users.demoOperator.id, startDay: -40, landDecimal: 45, hoursOrDays: 4, fieldOffsetKm: 1, paymentMethod: "CASH", fieldAddress: "Haripur" }, jamal],
    [{ status: "REVIEWED", farmerId: f5.id, machineKey: "tanorePump", operatorId: liton.id, startDay: -35, landDecimal: 120, hoursOrDays: 8, fieldOffsetKm: 3, paymentMethod: "MOCK", fieldAddress: "Kalma" }, tanore],
    [{ status: "PAID", farmerId: f2.id, machineKey: "barindReaper", operatorId: sumon.id, startDay: -28, landDecimal: 180, fieldOffsetKm: 9, paymentMethod: "SSLCOMMERZ", fieldAddress: "Damkura" }, barind],
    [{ status: "REVIEWED", farmerId: f9.id, machineKey: "kamrulReaper", operatorId: babul.id, startDay: -21, landDecimal: 140, fieldOffsetKm: 4, paymentMethod: "MOCK", fieldAddress: "Kushura" }, kamrul],
    [{ status: "PAID", farmerId: f1.id, machineKey: "jamalTiller", operatorId: shamim.id, startDay: -14, landDecimal: 90, fieldOffsetKm: 2, paymentMethod: "CASH", fieldAddress: "Parila" }, jamal],
    [{ status: "REVIEWED", farmerId: f6.id, machineKey: "barindTransplanter", operatorId: sumon.id, startDay: -12, landDecimal: 66, fieldOffsetKm: 6, paymentMethod: "SSLCOMMERZ", fieldAddress: "Rishikul" }, barind],
  ];

  const created = [];
  let serial = 1;
  for (const [seed, actors] of [...plan, ...history]) {
    created.push(await createSeedBooking(serial++, seed, machines, rules, actors));
  }
  return created;
}

// ─────────────────────────── 8. Everything else ───────────────────────────

async function seedExtras(
  users: Users,
  machines: Machines,
  rules: Rules,
  upazilas: Upazilas,
  bookings: Awaited<ReturnType<typeof seedBookings>>,
) {
  const [f1, f2, f3, f4] = users.farmers;
  const [requested, , , , , onTheWay, , breakdown, , paid, reviewed, disputed] = bookings;

  // A cooperative in Haripur village with 5 members
  const cooperative = await db.cooperative.create({
    data: {
      name: "Haripur Krishi Samabay Samity",
      leaderId: users.coopLeader.id,
      locationId: upazilas.get("Paba")!.id,
      village: "Haripur",
      registrationNo: "COOP-RAJ-0457",
    },
  });
  await db.cooperativeMember.createMany({
    data: [users.demoFarmer, f1, f2, f3, f4].map((farmer) => ({
      cooperativeId: cooperative.id,
      farmerId: farmer.id,
    })),
  });

  // The breakdown (booking 8): report + repair request for the technician
  const tanoreTiller = machines.get("tanoreTiller")!;
  const report = await db.breakdownReport.create({
    data: {
      bookingId: breakdown.id,
      machineId: tanoreTiller.id,
      reportedById: users.operators[2].id,
      description: "Gear box makes noise and the tiller stopped.",
      completedQuantity: 0.4,
      status: "SEARCHING",
    },
  });
  await db.machine.update({ where: { id: tanoreTiller.id }, data: { status: "UNDER_MAINTENANCE" } });
  await db.maintenanceRequest.createMany({
    data: [
      { machineId: tanoreTiller.id, requestedById: users.tanoreProvider.id, technicianId: users.demoTechnician.id, breakdownReportId: report.id, type: "REPAIR", description: "Gear box noise, tiller stopped during work.", status: "INSPECTING" },
      { machineId: machines.get("tanorePump")!.id, requestedById: users.tanoreProvider.id, technicianId: users.demoTechnician.id, type: "SERVICE", description: "Engine hours passed service limit (2000 h).", status: "RECEIVED" },
      { machineId: machines.get("barindTractor")!.id, requestedById: users.barindProvider.id, technicianId: users.demoTechnician.id, type: "SERVICE", description: "Regular 2000 hour service.", status: "REPAIRING", partsUsed: "Engine oil 8L, oil filter x1", partsCost: 4200, labourCost: 1500 },
      { machineId: machines.get("jamalTractor")!.id, requestedById: users.demoProvider.id, technicianId: users.demoTechnician.id, type: "SERVICE", description: "500 hour service.", status: "FIXED", partsUsed: "Engine oil 6L, fuel filter x1, air filter x1", partsCost: 3800, labourCost: 1200, technicianNote: "All good. Next service at 1000 h.", fixedAt: daysFromNow(-50) },
    ],
  });

  // Subsidy money already used by the paid bookings
  const usedSubsidy = paid.subsidyAmount + reviewed.subsidyAmount;
  await db.subsidyProgram.updateMany({ data: { usedAmount: usedSubsidy } });

  // A dispute about booking 12
  await db.dispute.create({
    data: {
      bookingId: disputed.id,
      raisedById: users.farmers[8].id,
      reason: "Area mismatch",
      description: "Operator wrote 0.8 acre but only about 0.6 acre was planted.",
    },
  });

  // A payout already sent to the demo provider for the reviewed booking.
  // Provider gets: work charge + delivery charge - platform fee.
  const providerShare = reviewed.workCharge + reviewed.deliveryCharge - reviewed.platformFee;
  await db.payout.create({
    data: {
      providerId: users.demoProvider.id,
      amount: providerShare,
      status: "PAID",
      reference: "bKash TRX 9KJ27XQ1",
      paidAt: daysFromNow(-15),
      bookings: { connect: { id: reviewed.id } },
    },
  });

  // A farmer waiting for a combine harvester
  const durgapur = upazilas.get("Durgapur")!;
  await db.waitlistEntry.create({
    data: {
      farmerId: users.farmers[9].id,
      machineTypeId: rules.get("Combine Harvester")!.machineTypeId,
      workType: "HARVESTING",
      locationId: durgapur.id,
      fieldLat: durgapur.lat,
      fieldLng: durgapur.lng,
      landDecimal: 99,
      wantedDate: daysFromNow(6),
    },
  });

  // A support ticket with a short conversation
  const ticket = await db.supportTicket.create({
    data: {
      userId: users.demoFarmer.id,
      subject: "Operator arrived 1 hour late",
      status: "IN_PROGRESS",
      bookingId: reviewed.id,
    },
  });
  await db.ticketMessage.createMany({
    data: [
      { ticketId: ticket.id, senderId: users.demoFarmer.id, body: "The operator came one hour late. Please tell the provider.", createdAt: daysFromNow(-19, 10) },
      { ticketId: ticket.id, senderId: users.admin.id, body: "Sorry for this. We have informed the provider.", createdAt: daysFromNow(-19, 14) },
    ],
  });

  // Notifications (some as simulated SMS), in English and Bangla
  await db.notification.createMany({
    data: [
      { userId: users.demoFarmer.id, channel: "SMS", title: "Booking received", titleBn: "বুকিং গ্রহণ করা হয়েছে", body: `Your booking ${requested.code} was sent to the provider. Total: ${requested.totalAmount} Tk.`, bodyBn: `আপনার বুকিং ${requested.code} যন্ত্র মালিকের কাছে পাঠানো হয়েছে। মোট: ${requested.totalAmount} টাকা।` },
      { userId: users.demoFarmer.id, channel: "IN_APP", title: "Operator on the way", titleBn: "চালক রওনা দিয়েছেন", body: `Selim Mia is coming for booking ${onTheWay.code}.`, bodyBn: `বুকিং ${onTheWay.code} এর জন্য সেলিম মিয়া আসছেন।` },
      { userId: users.demoFarmer.id, channel: "SMS", title: "Payment received", titleBn: "টাকা পাওয়া গেছে", body: `We received your payment for ${paid.code}. Thank you!`, bodyBn: `${paid.code} এর টাকা পাওয়া গেছে। ধন্যবাদ!`, isRead: true },
      { userId: users.demoProvider.id, channel: "IN_APP", title: "New booking request", titleBn: "নতুন বুকিং অনুরোধ", body: `A farmer requested your tractor (${requested.code}).`, bodyBn: `একজন কৃষক আপনার ট্রাক্টর চেয়েছেন (${requested.code})।` },
      { userId: users.demoOperator.id, channel: "SMS", title: "New job today", titleBn: "আজ নতুন কাজ", body: `Job ${onTheWay.code}: irrigation pump at Haripur, 10:00 AM.`, bodyBn: `কাজ ${onTheWay.code}: হরিপুরে সেচ পাম্প, সকাল ১০টা।` },
      { userId: users.demoTechnician.id, channel: "IN_APP", title: "Repair request", titleBn: "মেরামতের অনুরোধ", body: "Power tiller DF-15L broke down in Tanore.", bodyBn: "তানোরে পাওয়ার টিলার DF-15L নষ্ট হয়েছে।" },
      { userId: users.admin.id, channel: "IN_APP", title: "Provider waiting for approval", titleBn: "যন্ত্র মালিক অনুমোদনের অপেক্ষায়", body: "Ayesha Siddika registered as a provider.", bodyBn: "আয়েশা সিদ্দিকা যন্ত্র মালিক হিসেবে নিবন্ধন করেছেন।" },
      { userId: users.demoOfficer.id, channel: "IN_APP", title: "New subsidy application", titleBn: "নতুন ভর্তুকি আবেদন", body: "Shafiqul Islam applied for the small farmer subsidy.", bodyBn: "শফিকুল ইসলাম ক্ষুদ্র কৃষক ভর্তুকির জন্য আবেদন করেছেন।" },
    ],
  });

  // A few audit log rows (who approved what)
  await db.auditLog.createMany({
    data: [
      { actorId: users.admin.id, action: "PROVIDER_APPROVED", entityType: "ProviderProfile", entityId: users.demoProvider.id, details: "Approved Jamal Krishi Seba", createdAt: daysFromNow(-90) },
      { actorId: users.admin.id, action: "MACHINE_APPROVED", entityType: "Machine", entityId: machines.get("jamalTractor")!.id, details: "Approved Mahindra 575 DI", createdAt: daysFromNow(-89) },
      { actorId: users.govtUser.id, action: "PRICING_RULE_CREATED", entityType: "PricingRule", details: "Created price limits for 8 machine types", createdAt: daysFromNow(-100) },
      { actorId: users.govtUser.id, action: "SUBSIDY_PROGRAM_CREATED", entityType: "SubsidyProgram", details: "Small Farmer Mechanization Support 2026", createdAt: daysFromNow(-95) },
      { actorId: users.admin.id, action: "USER_SUSPENDED", entityType: "User", entityId: users.farmers[6].id, details: "Fake NID reported by officer", createdAt: daysFromNow(-5) },
    ],
  });
}

// ─────────────────────────── Run everything ───────────────────────────

async function main() {
  console.log("Emptying the database...");
  await emptyDatabase();

  console.log("Adding settings, places, machine types and prices...");
  await seedSettings();
  const upazilas = await seedLocations();
  const rules = await seedMachineTypesAndPrices();
  const program = await seedSubsidyProgram();

  console.log("Adding users...");
  // Every demo user has the same password, so we hash it only once (bcrypt is slow on purpose).
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = await seedUsers(upazilas, passwordHash);

  // Subsidy applications: the demo farmer is approved, others pending / rejected
  const approvedApplication = await db.subsidyApplication.create({
    data: {
      programId: program.id,
      farmerId: users.demoFarmer.id,
      status: "APPROVED",
      note: "I have 150 decimal of land.",
      reviewedById: users.demoOfficer.id,
      reviewedAt: daysFromNow(-40),
    },
  });
  await db.subsidyApplication.createMany({
    data: [
      { programId: program.id, farmerId: users.farmers[1].id, status: "PENDING", note: "Please help, small land." },
      { programId: program.id, farmerId: users.farmers[0].id, status: "APPROVED", reviewedById: users.demoOfficer.id, reviewedAt: daysFromNow(-20) },
      { programId: program.id, farmerId: users.farmers[3].id, status: "REJECTED", reviewedById: users.demoOfficer.id, reviewedAt: daysFromNow(-25), rejectionReason: "Land is more than 200 decimal." },
    ],
  });

  console.log("Adding machines and bookings...");
  const machines = await seedMachines(upazilas, rules, users);
  const bookings = await seedBookings(users, machines, rules, approvedApplication.id);

  console.log("Adding cooperative, repairs, payouts, tickets and notifications...");
  await seedExtras(users, machines, rules, upazilas, bookings);

  console.log(`Done! ${bookings.length} bookings created. Log in with 01700000001 / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
