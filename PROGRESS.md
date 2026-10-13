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

---

## Phase 3 — Pricing + search (13 October 2026)

**What was built**

- The full booking price in `pricing.ts`: work charge (with a minimum), delivery after the free km, government subsidy, the farmer's total, the platform fee and the provider's share — all in whole taka. The project example (66 decimal, 2,400 Tk/acre, 8 km, 20% subsidy) gives exactly 1,517 Tk for the farmer, 55 Tk fee and 1,779 Tk for the provider. The seed uses the same formula.
- Government **Price limits** page: for each machine type set the lowest and highest rate, the harvest season with its extra %, the delivery charge per km after the free km, and the minimum charge. Saving keeps the old limit as history, writes the audit log, and messages every provider whose rate is now outside the limit (their machine page shows a red warning). The govt dashboard counts types with a limit and machines outside it.
- Public **Price calculator** (no login): pick a machine, the land (decimal / bigha / acre) or hours/days, a rate inside the government limit, the distance and the subsidy; the price is shown line by line and changes as you type.
- Farmer **Find machines**: choose the work, the machine (or any), land size, day, the field on the map (tap, "use my location" or "go to upazila") and 5–50 km. Results appear on a map (search circle + numbered pins) and as cards with distance, rating, provider and the estimated price; sort by nearest or cheapest. Machines that are not approved, under repair, due for service, priced outside the limit or busy on that day are left out. The search is kept in the page address, so Back and reload work.
- **Machine suggestion**: a small rule table (combine harvester above 100 decimal of harvest, otherwise reaper; power tiller below 50 decimal of tilling, otherwise tractor; pump, transplanter, seeder, sprayer) shown above the results with a "Show only …" button.
- Farmer **machine page**: photos, the price for the farmer's own job (with their subsidy), facts, free days for the next 2 weeks, the machine and the field on a map, and the latest reviews.

**How to test it**

- Open http://localhost:3000/en/price-calculator without logging in: choose Tractor, 66 decimal, rate 2400, distance 8 and tick the subsidy box — "You pay" shows 1,517 Tk.
- Log in as the farmer (`01700000001`) → **Find machines**: the first search (tilling, 150 decimal, Paba) shows 2 machines with the 20% subsidy already taken off and suggests a Tractor. Change the work to Harvesting, go to upazila Godagari, pick 25 km and search: a Combine Harvester is suggested and one reaper is "busy on this day". Press **Cheapest**.
- Tap a result: the machine page shows the price line by line, the free days, the map and reviews; **Back to search** returns to the same results. Switch to **বাং** to see the pages in Bangla.
- Log in as govt (`01700000007`) → **Price limits** → Tractor → set the highest rate to 2500 and save: "2 machines are now outside the limit", and the old limit appears under "Earlier limits". Provider Kamrul (`01720000003`) gets a message and a red note on his Massey Ferguson, and it no longer appears in the farmer search. Run `npm run db:seed` afterwards to reset the demo data.
- `npm test` runs 113 unit tests (price formula, price limit form, suggestion rules, search sort and address, subsidy, calendar); `npm run lint` and `npm run build` pass.
