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

---

## Phase 4 — Booking (16 October 2026)

**What was built**

- **3-step booking form** (farmer): 1) the job — work, land size (or hours/days) and the field on the map; 2) the day and a start time — times when the machine is already booked or blocked are crossed out, and the form says how long the work takes; 3) a summary and a message for the provider. The price card beside the form changes live while the farmer types (the same formula as the server). It opens from **Book this machine** on the machine page and starts with the farmer's search.
- **No double booking**: the booking is saved inside one database transaction that first locks the machine's row, then refuses any active booking or blocked time that overlaps. Two farmers pressing "Book now" at the same moment for the same time: one gets the booking, the other is told the time is taken. Each booking gets a code like `KJ-2026-000023`.
- **One door for every status change**: `changeBookingStatus()` checks the allowed move (e.g. Requested → Accepted, never Requested → Working) and writes a history row (who, what, when). The booking page shows these rows as a **timeline**, with the steps still to come in grey.
- **Provider**: a **Bookings** page grouped by what to do (new requests, need an operator, upcoming/working, earlier). Accept, or reject with a reason; accepting makes the farmer's two 4-digit codes. Then **choose an operator** — only approved operators of this provider, and one already busy at that time is greyed out.
- **Operator**: **My jobs** (to do now, coming up, done) and a job screen with the farmer's phone, the field on the map and one big button at a time: **On the way → I have arrived → Start** (type the farmer's start code) **→ Finish** (type the real land or hours worked and the farmer's finish code). The final bill is worked out again from the real amount. Codes may be typed with Bangla digits.
- **Farmer**: **My bookings** and a booking page with the status, the secret start/finish code (only the farmer ever sees them), the timeline, the provider and operator to call, the bill and the field map. Every step sends a message (simulated SMS) to the right people, and tapping a message opens its booking. Dashboards show current bookings, waiting requests and today's jobs.

**How to test it** (run `npm run db:migrate` once for the new `arrivedAt` column, then `npm run db:seed`)

- Farmer `01700000001` → **Find machines** → tap the Mahindra 575 DI → **Book this machine**: type 66 decimal (the price becomes 1,267 Tk), **Next**, pick tomorrow 10:00 AM, **Next**, **Book now**. The booking page shows "Requested" and the timeline. Open the same booking form again as farmer `01710000001`: 9, 10 and 11 AM are now crossed out.
- Provider `01700000003` → **Bookings**: the new request is at the top. Press **Reject** with an empty reason (refused), then **Accept**. The farmer now sees a start code on the booking page and in **Messages**. Back as the provider, choose **Selim Mia** and press **Send this operator**.
- Operator `01700000004` → **My jobs** → the new job: **I am on the way**, **I have arrived**, type a wrong start code (refused), then the farmer's start code → "Working". Type 70 for the land and the farmer's finish code → "Work done". The farmer's bill becomes 1,680 − 336 = **1,344 Tk**.
- As the farmer, open **Messages** and tap a message: it opens that booking. Switch to **বাং**: every new page is in Bangla, with Bangla digits in codes and times.
- Log in as another operator (`01730000005`) and open Selim's job address: "Page not found".
- `npm test` runs 146 unit tests (status moves, job time, codes, timeline, list groups, booking form and OTP rules); `npm run lint` and `npm run build` pass.

---

## Phase 5 — Payments + subsidy (23 October 2026)

**What was built**

- **Paying for a finished job** (farmer): once the work is done, the booking page asks for the bill. **Pay online** goes through a `PaymentGateway` interface with two gateways: a **test gateway** (a pretend bank page inside the app: Pay / Make it fail / Cancel) and the **SSLCommerz sandbox** (switched on in `.env`). The farmer comes back to a **success** or **failed** page that shows what the database says, never what the address says; SSLCommerz's answer is always checked again with SSLCommerz itself, and a payment confirmed twice (return page + IPN) is saved only once. Or **cash on completion**: the operator (or provider) presses **Cash received** after a "Did you receive … Tk?" check. Either way the booking becomes PAID in one transaction, the subsidy is taken from the program's budget and both sides get a message.
- **PDF receipt** (`@react-pdf/renderer`): **Download receipt** on the booking page and the success page; only the farmer who paid can get it.
- **Refunds** (admin → **Payments**): give back part or all of a successful payment with a reason. A refund is saved as PENDING first inside a locked transaction, so two admins can never give back more than was paid; online payments are refunded through the same gateway. If a booking is paid twice (cash and online at the same time), the admins get a message to refund one.
- **Payouts**: the provider's new **Earnings** page shows their share of each paid job (work + delivery − 3% fee), the cash they already took, refunds, and what KrishiJontro still owes them; for a cash job without subsidy that can be below 0 (they hold our fee). The admin's **Payouts** tab lists providers we owe, and "I have sent … Tk" (with the bKash reference) puts all their paid bookings into one payout, so nothing is paid out twice.
- **Farmer verification**: the farmer's new **Subsidy** page, step 1, sends their NID, land (decimal / bigha / acre), village and upazila. The **agriculture officer of that upazila** (and only that one) sees them on **Verify farmers** and verifies or rejects with a reason (new column `FarmerProfile.rejectionReason`). A verified farmer cannot change these details alone.
- **Subsidy**: the government's new **Subsidy programs** page creates and changes programs (discount %, land limit, budget, dates, on/off; the budget cannot go below what is spent). The farmer applies (step 2), the officer approves on **Subsidy applications** (only a verified farmer within the land limit) or rejects with a reason, and the farmer may apply again after a rejection. Approved farmers see the discount in every price. Every officer and govt decision writes the audit log. Dashboards show payment, payout, verification and subsidy numbers.

**How to test it** (run `npm run db:migrate` once for the new column, then `npm run db:seed`)

- Farmer `01700000001` → **My bookings** → the finished Mahindra 575 DI job (`KJ-2026-000013`) → **Pay 1,517 Tk online** → on the test bank page press **Make it fail** first (back on the booking: "did not go through"), then pay again and press **Pay** → "Payment successful" → **Download receipt (PDF)**: work 1,584, delivery 250, subsidy −317, total 1,517 Tk. Govt `01700000007` → dashboard: subsidy spent grows from 630 to 947 Tk.
- Operator `01730000004` (Babul Mia) → **My jobs** → job `KJ-2026-000009` → **Cash received: 1,950 Tk** → **Yes, I have the cash**. Farmer `01710000008` gets a message and can download her receipt.
- Admin `01700000008` → **Payments**: on the demo farmer's 1,517 Tk payment press **Refund**, try 2,000 (refused: "more than what is left"), then 300 with a reason → the farmer's booking page lists the refund. **Payouts** tab → Jamal Krishi Seba → type a reference → **I have sent … Tk**; provider `01700000003` → **Earnings** shows the payout and nothing waiting.
- Officer `01700000006` → **Subsidy applications**: Shafiqul Islam cannot be approved yet ("verify first") → **Verify farmers** → **Verify** him → back to **Subsidy applications** → **Approve**. Log in as `01710000002`: **Find machines** now takes 20% off. Farmer `01710000003` → **Subsidy** → **Apply**; the officer rejects with a reason; she sees it and can **Apply again**.
- Govt `01700000007` → **Subsidy programs** → change the budget to 100 Tk (refused: below what is spent), or add a new program. Switch to **বাং**: every new page is in Bangla (the PDF receipt is in English only, because the PDF library cannot draw Bangla letters correctly).
- `npm test` runs 187 unit tests (payment rules, SSLCommerz request/answer, test gateway, refund/payout/subsidy forms, who may apply / be approved); `npm run lint` and `npm run build` pass.
