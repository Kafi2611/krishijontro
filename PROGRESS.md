# KrishiJontro — Progress

What was built in each phase, and how to check it.

---

## Phase 1 — Setup (5 October 2026)

**What was built**

- Next.js 16 (App Router) + TypeScript project with Tailwind CSS and shadcn/ui; mobile-first green theme with large buttons.
- PostgreSQL database on Neon with Prisma: schema with all 32 tables (users, profiles, locations, machines, prices, subsidy, bookings, payments, reviews, disputes, tickets, notifications, audit log, settings), first migration and a seed script with demo data for every role (22 bookings covering all 12 booking statuses).
- Login with mobile number + password (Auth.js, bcrypt), register page for farmers and machine providers, role saved in the session.
- `proxy.ts` protects each role's pages (`/farmer`, `/provider`, `/admin` …); pages check the role again on the server.
- English / বাংলা switch (next-intl) with Bangla digits in Bangla mode.
- Navbar, role sidebar (slide-in menu on phones), an empty dashboard for each of the 8 roles, profile page, and a Messages page with an unread bell.
- Unit tests (Vitest) for distance + land units, role paths, Bangla digits and the login/register rules.

**How to test it**

- `npm run db:seed`, then `npm run dev` and open http://localhost:3000 — the home page shows the 8 machine types; press **বাং** to see the page in Bangla.
- Log in with each demo account (`01700000001` … `01700000008`, password `demo1234`); each lands on its own dashboard.
- While logged in as a farmer, open `/en/admin` — you are sent back to `/en/farmer`. Logged out, `/en/farmer` sends you to the login page.
- Register a new farmer with a new mobile number; you are logged in straight away. Try the same number again — "already registered".
- As the demo farmer open **Messages**: 2 new messages and a red number on the bell; press **Mark all as read**.
- `npm test` runs 23 unit tests; `npm run lint` and `npm run build` pass.
