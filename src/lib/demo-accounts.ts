// The demo users created by prisma/seed.ts — one for each role.
// The login page lists them in development mode only, so testing is quick.
import type { Role } from "@/generated/prisma/enums";

export const DEMO_PASSWORD = "demo1234";

export const DEMO_ACCOUNTS: { phone: string; role: Role; name: string }[] = [
  { phone: "01700000001", role: "FARMER", name: "Abdul Karim" },
  { phone: "01700000002", role: "COOP_LEADER", name: "Rafiqul Islam" },
  { phone: "01700000003", role: "PROVIDER", name: "Jamal Uddin" },
  { phone: "01700000004", role: "OPERATOR", name: "Selim Mia" },
  { phone: "01700000005", role: "TECHNICIAN", name: "Habib Rahman" },
  { phone: "01700000006", role: "OFFICER", name: "Nasima Akter" },
  { phone: "01700000007", role: "GOVT", name: "Mahbub Alam" },
  { phone: "01700000008", role: "ADMIN", name: "Admin KrishiJontro" },
];
