// Prisma CLI settings (used by `prisma migrate`, `prisma studio`, `prisma db seed`).
// It tells Prisma where the schema, the migrations and the seed script are,
// and which database to talk to.
import "dotenv/config"; // loads the values from .env into process.env
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Neon gives two connection strings. Migrations must use the DIRECT one
    // (without "-pooler"), because the pooler cannot hold the locks migrations need.
    // The running app uses DATABASE_URL (pooled) in src/lib/db.ts.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
