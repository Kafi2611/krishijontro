# KrishiJontro (কৃষিযন্ত্র)

KrishiJontro is a web platform where farmers in Bangladesh book agricultural machines
(tractor, power tiller, combine harvester, rice transplanter, irrigation pump and more)
together with a trained operator, at a fair price that stays inside government limits.

It is built for the course **CSE 3200 – Software Development Project II**.

## Who uses it

| Role | What they do |
| --- | --- |
| Farmer | Search machines, book, pay, review |
| Cooperative leader | Group bookings for member farmers |
| Machine provider | Add machines, set rates, accept jobs |
| Operator | Drives the machine, starts/finishes jobs with OTP |
| Technician | Repairs and services machines |
| Agriculture officer | Verifies farmers, approves subsidies |
| Government authority | Sets price limits and subsidy programs |
| Admin | Approvals, users, disputes, settings |

## Tech stack

Next.js (App Router) + TypeScript, Tailwind CSS + shadcn/ui, PostgreSQL (Neon) + Prisma,
Auth.js, next-intl (English / বাংলা), Zod + React Hook Form, Vitest.

## Run it on your computer

1. Install **Node.js 22** or newer.
2. Install packages:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in the values
   (a Neon PostgreSQL connection string and an `AUTH_SECRET`).
4. Create the database tables and fill them with demo data:
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```
5. Start the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app in development mode |
| `npm run build` | Build the app for production |
| `npm run lint` | Check code style |
| `npm test` | Run unit tests (Vitest) |
| `npm run db:seed` | Fill the database with demo data |
| `npx prisma studio` | Open a browser view of the database |

See [PROGRESS.md](PROGRESS.md) for what has been built in each phase.
