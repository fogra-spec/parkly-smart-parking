# Parkly application

## Architecture

Next.js 16 App Router APIs, React and TypeScript. Vinext runs the Next.js application through Vite and Cloudflare Workers for Sites hosting. This is an alternative Next.js runtime; use the supplied build script. Tailwind CSS and custom responsive styles define the neutral/teal interface. Icons use Lucide.

UI: `app/parkly.tsx` and `app/parking-map.tsx`. Finance logic: `lib/finance.ts`. API routes perform Zod validation and role checks. Persistent database: Cloudflare D1 SQLite, both locally and on Sites. Drizzle models: `db/schema.ts`. Future PostgreSQL design and transaction requirements: `db/postgres-schema.sql`. PostgreSQL is not connected.

The API checks overlapping reservations within one conditional SQL INSERT. D1 serializes that statement, preventing concurrent overbooking. Capacity cannot be reduced below peak reserved inventory. Overlap counting is conservative: bookings overlapping different parts of a long interval can cause a false sold-out result. Production should allocate discrete spaces or compute exact peak overlap.

## Setup and run

Requires Node.js >=22.13 and pnpm; tested with Node24.19/pnpm11.25. Installation and map tiles require internet. The booking/list interface remains usable without map tiles.

```bash
cd "/Users/dmp/Documents/codex tg/parkly/site"
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_high_gabe_jones.sql
pnpm dev
```

Open the printed Local URL, normally `http://127.0.0.1:5173/`. Apply each migration only once to a new database. Fictional accounts/listings are inserted on the first API request with `INSERT OR IGNORE`, preserving edits. Local data survives restarts under ignored `.wrangler/state`. Hosted and local data are separate.

Bundled executable paths on this computer:

```bash
export PATH="/Users/dmp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/dmp/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
```

## Checks

```bash
pnpm test
node node_modules/typescript/bin/tsc --noEmit
node tests/api.integration.mjs
```

The API test requires a running local server and disposable classroom database. It creates and cancels fictional bookings, temporarily changes one capacity and restores it. Never run it against production. It tests an eight-request race for one slot, persistence, price, cancellation/rebooking, capacity floors, ownership, approval gates, favorites and invalid dates. Cancelled test history remains.

## Implemented behavior

Search; price/type/current-demo-availability filters; list/map views; geographic zoom/pan; details; selected-time inventory; 1–24-hour booking and review; persistent references; cancellation; history; favorites; profile display name. Operators edit their own prices/capacity, review bookings, utilization and completed allocation. Admin manages account enablement, listing approvals and demo metrics. Financial inputs recalculate revenue, expenses, profit, break-even and chart bars.

EN/RU switching translates core navigation, hero and key booking labels. Secondary dashboard, administration and financial explanations remain English. This is partial Russian localization.

## Demo accounts and limitations

The chooser is clearly labeled **demo authentication**. Any visitor can select Driver, North Parking operator, East Parking operator or Administrator. An HTTP-only SameSite cookie and server checks enforce the selected role and owner. This demonstrates authorization, not real identity verification. Production signup, isolated accounts, recovery, audit trails, rate limits, retention controls and security review remain future work.

Six listings are fictional; one starts pending approval. Coordinates show approximate areas, not participating facilities. Inventory is simulated. Current availability differs from selected future availability. Book whole-hour slots, 1–24 hours, within 90 days. Prices are captured at booking. Driver cancellation is allowed before start. Operators can cancel their bookings and mark them completed after end. Ended bookings await completion; no automatic no-show classification is claimed.

No bank payment, refund, barrier, sensor, camera, real occupancy feed or actual revenue integration is connected. BPMN exception workflows are proposed service design; not all are automated in the MVP. Use fictional details only. Real Kazakhstan operation needs data-location assessment, suitable hosting, partner contracts and legal/payment/tax review.

## Financial meanings

Modeled bookings are eligible completed bookings. Processing fees apply to full GMV, using the classroom0.95% assumption. Parkly commission is10%; operator allocation90% before its costs. B2B subscription revenue is separate. Dashboard operating results exclude tax, setup, depreciation and financing; XLSX includes setup/cash-flow schedules. Paid B2B accounts should not exceed partners. None of these are observed commercial results.

## Hosting

`.openai/hosting.json` preserves the Site identity and D1 `DB` binding. Use Sites build/source/publication helpers; do not invent database IDs or keys. Hosted migrations apply to a separate database. Keep credentials, local data and `.sites-runtime` outside source archives. Map tiles are attributed to OpenStreetMap; use an appropriate licensed provider or self-hosting before scaling.
