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

---

## Phase 2 — Machines (9 October 2026)

**What was built**

- Admin **Machine types** page: add or edit a type (English + Bangla name, category, work it can do, how rent is counted, icon) or hide it. The home page now reads the types from the database.
- Provider **My machines**: add, edit, view and delete machines with brand, model, year, HP, registration number, rate, upazila, an exact place picked on a map (Leaflet + OpenStreetMap) and up to 5 photos. The rate must stay inside the government limit for that machine type (higher limit in harvest season). Machines with bookings cannot be deleted; they can be set to "Stop renting" instead.
- Photo upload (`/api/upload`): only logged-in providers/operators, JPG/PNG/WebP up to 5 MB, the real file type is checked from its first bytes, files are saved with random names in `public/uploads`.
- **Availability calendar** for each machine: month view with free, blocked and booked days; block a range of days (not in the past, not on booked days) and remove blocks.
- Provider **Business details** and **Operators** pages: the provider fills in NID, address, payout account, and creates operator accounts.
- Admin **Approvals** page with three tabs (providers, machines, operators): approve, or reject with a reason. Each decision is saved in the audit log and the owner gets a message (simulated SMS). Admin and provider dashboards show counts.

**How to test it**

- Log in as admin (`01700000008`) → **Approvals**: 1 provider, 2 machines and 1 operator are waiting. Reject one with a reason (an empty reason is refused) and approve another; the list and the dashboard numbers go down.
- Log in as provider (`01700000003`) → **Messages** after the admin's decision, then **My machines → Add machine**: pick Tractor and type rate 3500 — it is refused (limit 2,000–3,000 Tk); use 2500, choose the upazila, tap the map, add photos and save. The machine shows "Pending".
- Open a machine → **Calendar**: tap a free day and block it (it turns red); try to block the amber (booked) day — it is refused. Remove the block again.
- As provider open **Operators → Add operator** and **Business details**; the admin then sees them in Approvals. A rejected provider who saves the details again goes back to "Pending".
- As admin open **Machine types**, add a new type; it appears on the home page and in the provider's machine form. Switch to **বাং** to see every new page in Bangla.
- `npm test` runs 74 unit tests (rate limits, calendar dates, upload file check, machine rules, form rules); `npm run lint` and `npm run build` pass.
