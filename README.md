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
3. Copy `.env.example` to `.env` and fill in the values:
   - `DATABASE_URL` — the **pooled** Neon connection string (host contains `-pooler`)
   - `DIRECT_URL` — the same string **without** `-pooler` (used only for migrations)
   - `AUTH_SECRET` — a long random string (the command to make one is in `.env.example`)
4. Create the database tables and fill them with demo data
   (the seed **empties all tables first**, so use a fresh or development database):
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```
5. Start the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Demo logins

After `npm run db:seed`, every demo account uses the password **`demo1234`**.
In development mode the login page also lists them (tap one to fill the form).

| Role | Mobile number |
| --- | --- |
| Farmer | 01700000001 |
| Cooperative leader | 01700000002 |
| Machine provider | 01700000003 |
| Operator | 01700000004 |
| Technician | 01700000005 |
| Agriculture officer | 01700000006 |
| Government authority | 01700000007 |
| Admin | 01700000008 |

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
