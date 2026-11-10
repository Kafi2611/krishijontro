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

---

## Phase 6 — Problems + service (28 October 2026)

**What was built**

- **Breakdown and emergency replacement**: while working, the operator presses **Report a breakdown** (work done so far, what is wrong, a photo). The booking becomes "Broken down", the machine goes under repair (nobody can book it) and the technicians get a repair request. Owners of a free machine of the same type within 15 km get an emergency message and an offer at the top of **Bookings**; the first to press **Send this machine** gets a new, already accepted booking for the rest of the work (the farmer's booked rate, free delivery, new codes, linked to the broken booking). The broken booking is billed only for the work done, so the farmer pays the same as without a breakdown (example: 760 + 826 = 1,586 Tk). Admin's new **Breakdowns** page: after 2 hours, **No replacement found** closes it (bill for the work done, or cancelled if nothing was done), puts the farmer on the waitlist and writes the audit log.
- **Technician**: **Repair requests** page with new requests (**Take this job**), own jobs and fixed ones; each job goes Received → Inspecting → Repairing → **Fixed** with parts, parts cost, labour cost and a note. A fixed machine is fit for work again (after a service the next one is due 250 engine hours later). The owner gets a message at each step.
- **Engine hours and service alerts**: every finished job adds engine hours (2 hours per acre, the hours worked, or 8 hours per day). The provider gets one message when fewer than 25 hours are left and when the service is due; the dashboard counts these machines, machine cards show an orange line, and the machine page has **Ask a technician** and the machine's service history.
- **Reviews and trust score**: after paying, the farmer gives 1–5 stars to the machine and to the operator separately (booking → "Reviewed"). Trust score = average stars × 20, minus 5 for each booking the provider cancelled in the last 90 days, kept between 0 and 100 (worked out again after every review and provider cancellation; the seed uses the same formula). Providers see it on the dashboard, operators see their own rating.
- **Cancellation rules**: the farmer cancels for free while the provider has not answered, or until 24 hours before the start; later the fee is 10% of the work charge, saved on the booking and shown on both booking pages. The provider can cancel an accepted booking with a reason: the farmer pays nothing and the trust score goes down. The hours and the % are platform settings (see README).
- **Waitlist**: when a search finds no free machine, **Join the waitlist**; the new **Waitlist** page lists the entries and lets the farmer leave. When a farmer cancels a booking on that day, or a machine comes back from repair, the first farmer waiting for that kind of machine within 25 km gets a message with a ready search. Next.js was also upgraded to 16.4.3 (security fix).

**How to test** (no new migration; run `npm run db:seed`)

- Provider `01700000003` → **Bookings**: the emergency offer for booking `KJ-2026-000008` (a power tiller broke down near Tanore) → **Send this machine** → the new booking waits under "Choose an operator". Farmer `01710000005` → **My bookings** → `KJ-2026-000008` is "Work done" with a 760 Tk bill and a link to the new booking (with its own codes). Admin `01700000008` → **Breakdowns** shows it under "Closed lately".
- Operator `01730000001` → the "Working" Yanmar AW70 job → **Report a breakdown** (type 50, a short problem, a photo). Admin → **Breakdowns** → **No replacement found**: the farmer's bill is only for 50 decimal and they appear on the waitlist.
- Technician `01700000005` → **Repair requests** → take the Lister pump service → **Start inspecting** → **Start repairing** → **Fixed** with costs. Then open the Dongfeng DF-15L repair → **Start repairing** → **Fixed**: the tiller is active again and farmer `01700000001` gets "A machine may be free" (their **Waitlist** shows it).
- Farmer `01700000001` → the paid Dongfeng DF-12L booking `KJ-2026-000010` → 5 + 5 stars → **Send review**: provider `01700000003`'s trust score goes from 90 to 93. On booking `KJ-2026-000025` (pump, starts in about 10 hours) **Change of plans?** shows a 60 Tk late fee. As the provider, cancel `KJ-2026-000002` with a reason: the trust score drops by 5. `KJ-2026-000024` shows "a fee of 90 Tk is due to you".
- Provider `01700000003` → **My machines**: the Dongfeng DF-12L says "Service in 20 hours"; open it → **Ask a technician**. Farmer → **Find machines** → a combine harvester with 5 km in an empty area → **Join the waitlist**. Switch to **বাং**: every new page is in Bangla.
- `npm test` runs 232 unit tests (breakdown bills, cancellation fee, trust score, service alerts, repair steps, the new form rules); `npm run lint` and `npm run build` pass.

---

## Phase 7 — Cooperatives, admin and dashboards (3 November 2026)

**What was built**

- **Cooperatives and group booking**: the cooperative leader makes their cooperative (name, upazila, village), adds member farmers by mobile number and removes them. **New group booking** in 3 steps: the job (work, machine type, day, start time, one pin for the village), the plots (tick at least 2 members, each with their land and a note), then a machine free for the WHOLE time. The machine does the plots one after another; the delivery is charged once and shared equally (250 Tk for 3 plots = 84 + 83 + 83). The minimum charge is checked once for ALL plots together: if they reach it, each member pays only for their own land (a 30 decimal plot pays for 30, not the 50 decimal minimum); if they are below it, the missing part is shared equally and saved on each booking (new column `Booking.minimumShare`), so the bill at the finish keeps it. Each member gets their own booking, codes and bill (with their own subsidy); the provider accepts each one. **Group bookings** lists them with how far each plot is.
- **Complaints (disputes)**: once the work is done the farmer can **Report a problem** (once per booking). Before paying, the payment waits; the admin can **correct the bill** (the right amount of work, worked out with the same formula as at the finish), then the farmer pays the new bill. After paying, the admin can **give money back** (the Payments refund code), **fine the provider** (taken off their next payout, shown on Earnings) or take **no action**; the booking goes back to Paid. Both sides get a message, the audit log gets a row, and the officer of the upazila can read it.
- **Support tickets**: every user has **Help**: ask a question (maybe about a booking) and talk with the KrishiJontro team in a chat-like thread. Admins answer and close tickets on **Support tickets**; each side gets a message.
- **Admin**: **Users** (filter by role, search, suspend with a reason or activate again; a suspended user is stopped on their next page, not only at their next login), **Add a staff account** (cooperative leader, technician, officer with their upazila, govt, admin), **Settings** (platform fee, cancellation rules, breakdown search), **Audit log** (every important action, filter by kind), **All bookings** with a read-only page for each booking.
- **Dashboards with charts** (Recharts, with "Show the numbers" tables): provider (earnings per month, jobs per machine), admin (bookings and fees per month, accounts per role), and the govt's new **Reports** page: a **demand heatmap** (one circle per upazila, bigger and darker = more bookings and waiting farmers), bookings by district, demand vs supply per machine type, prices against the limits, and subsidy per month. The officer's new **Bookings and complaints** page shows their upazila.
- **Fix**: the final bill at the finish now keeps the booked delivery charge (a replacement machine stays free of delivery, and a group member keeps their share).

**How to test** (run `npm install` once for Recharts and `npm run db:migrate` once for the new column, then `npm run db:seed`)

- Farmer `01700000001` → **My bookings** → `KJ-2026-000013` → **Report a problem** → "Wrong area or hours" → the Pay box goes away. Admin `01700000008` → **Complaints** → that booking → **Correct the bill** → 50 → a note → the farmer now pays 1,210 Tk instead of 1,517. On the same page `KJ-2026-000026` was paid: **Give money back** 200 Tk; "Decided lately" shows the 300 Tk fine on `KJ-2026-000020` (Barind's **Earnings**, `01720000001`, counts it).
- Cooperative leader `01700000002` → **Group bookings**: the Haripur group (3 plots, one trip of 150 Tk shared 50 + 50 + 50) → **New group booking**: Tilling, Power Tiller, a day, tick 2 members → **Next** → pick a machine → **Book for 2 members**. Provider `01700000003` → **Bookings** shows the group requests; member `01710000001` sees "Your share of one trip" on their bill, and member `01710000002`'s 30 decimal plot has a 720 Tk work charge (30 decimal × 2,400, no minimum of its own). In a new group on the Power Tiller give two members 10 decimal each: together they are below its 25 decimal minimum, so step 3 shows "minimum share 38 Tk" and "37 Tk" (they pay 375 Tk together, the minimum).
- Any user → **Help** → **Ask for help**; admin → **Support tickets** → answer → the user gets a message and sees "KrishiJontro support" in the thread. Provider `01700000003` already has a question waiting.
- Admin → **Users**: search `01710000010` → **Suspend** with a reason (that farmer, if logged in, is sent to the login page on their next click) → **Activate**. **Add a staff account** → Officer (an upazila is required) → log in as them. **Settings** → fee 4% → **Audit log** shows "Settings changed".
- Provider and admin **Dashboard** charts; govt `01700000007` → **Reports** (heatmap, districts, demand vs supply, prices, subsidy); officer `01700000006` → **Bookings and complaints**. Switch to **বাং**: Bangla digits and month names; everything is in Bangla.
- `npm test` runs 305 unit tests (final bill, settings, user filters and staff form, complaints and fines, tickets, cooperative and group booking rules with the group minimum charge, chart helpers); `npm run lint` and `npm run build` pass.

---

## Phase 8 — Quality + deploy (in progress, 10 November 2026)

**What is done so far**

- **Fixes from testing**: `npm audit fix` (without `--force`); the login and register forms are sent with POST, so the phone and password never appear in the address; a refund the payment gateway cannot send (e.g. SSLCommerz without keys) is saved as **Failed** with a clear message, and a failed refund never counts as money given back; machine and breakdown photos go to **Vercel Blob** when `BLOB_READ_WRITE_TOKEN` is set (still `public/uploads` on our own computer), and the photo limit is now 4 MB because Vercel refuses bigger requests.
- **Codes and bills**: the start and finish codes **lock after 5 wrong tries** (the operator sees how many tries are left; the farmer gets a message and a **Get a new code** button; new column `Booking.otpWrongTries`); a cancelled or rejected booking shows that nothing is to be paid (or only the late cancellation fee), in the bill and in every list.
- **Complaints and money**: after the admin decides a complaint on an unpaid booking the badge says **Waiting for payment** (not "Complaint open"), and a bill correction is written in the audit log as **Bill corrected**; a refund or fine decided **after** a provider was paid out is carried forward and taken from their next payout (Earnings and the admin's Payouts show it); a group plot that breaks down keeps its share of the group's minimum charge, split between the broken machine's bill and the replacement's bill by the work each one did. The admin's booking page shows each refund's status.
- **Bangla**: times show as **সকাল ৮:০০ / বিকাল ৪:৩০** instead of AM/PM (one formatter for the whole app, `lib/format.ts`); map pin numbers, the settings limits, the footer and the demo messages use Bangla digits; the audit log names each kind of record; subsidy programs get a **Bangla description** (new column `SubsidyProgram.descriptionBn`). Every page of every role was opened in Bangla at **360 px** phone width: no page scrolls sideways and no screen text is left in English (names, notes and model numbers that people typed stay as typed).
- **End-to-end tests (Playwright)**: `npm run test:e2e` opens a real browser (Edge on Windows) and runs the **main flow** — register a new farmer → search → book (3 steps) → provider accepts → sends an operator → start code → finish code → pay online → review — plus a check that the group booking form asks for a machine type before step 2 (that error now also goes away once a type is chosen).

**How to test what is done** (run `npm install`, then `npm run db:migrate` once for the 3 new migrations, then `npm run db:seed`)

- Open `/en/login`, turn JavaScript off in the browser and press **Log in**: the address stays `/en/login` (no phone or password in it).
- Admin `01700000008` → **Payments** → **Refund** on an SSLCommerz payment (no keys in `.env`): a clear error, and the refund shows **Failed**.
- Operator `01700000004` → a job "On the way" → **I have arrived** → type a wrong start code 5 times: "The code is locked". Farmer `01700000001` → that booking → **Get a new code** → the operator types the new code.
- Switch to **বাং**: booking times read "সকাল ৯:০০"; the farmer's **Subsidy** page shows the program description in Bangla.
- `npm test` runs 333 unit tests and `npm run test:e2e` runs 2 browser tests (it builds the site and starts it on port 3100 by itself); `npm run lint` and `npm run build` pass.

**Still to do in Phase 8**

- Check the same pages in **English** at 360 px, take the **screenshots** (`docs/screenshots/`) and write the **final README** (features, screenshots, setup steps, demo logins).
- Look again at `npm audit`: it shows 17 advisories now (some came with Vercel Blob and Playwright); the rest need `--force`, which is not used.
- **Final review** of the whole project (security, bugs, performance, accessibility, code quality) with a short report, then small fixes. Already noted: card titles are not real headings (accessibility), and audit log notes are written in English only.
- **Deploy preparation** for Vercel + Neon: the build runs `prisma migrate deploy`, both database addresses use `sslmode=verify-full` (`DIRECT_URL` in `.env.example` still says `require`), the deploy guide in the README and the Vercel website steps.
- End of phase: `study/phase-8.md`, `study/99-full-project-tour.md`, the `docs(progress): complete phase 8` commit and the `phase-8` tag.
