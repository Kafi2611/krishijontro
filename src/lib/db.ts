// The one shared Prisma client for the whole app — our "door" to the PostgreSQL database.
// Import it anywhere on the server with:  import { db } from "@/lib/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// In development, Next.js reloads our files on every save. Without this trick each
// reload would create a new PrismaClient and open new database connections until
// Neon refuses more. So we keep one client on the global object and reuse it.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Creates a Prisma client that talks to PostgreSQL through the "pg" driver.
 * Uses DATABASE_URL from .env (the pooled Neon connection string).
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
