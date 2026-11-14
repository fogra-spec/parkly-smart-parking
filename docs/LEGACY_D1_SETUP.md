# Historical D1 phase — superseded for PostgreSQL mode

Kept for existing D1 users and audit evidence. Use the current README and ARCHITECTURE for the PostgreSQL application.

# Parkly application

## Architecture

Next.js 16 App Router APIs, React and TypeScript. Vinext runs the Next.js application through Vite and Cloudflare Workers for Sites hosting. This is an alternative Next.js runtime; use the supplied build script. Tailwind CSS and custom responsive styles define the neutral/teal interface. Icons use Lucide.

UI: `app/parkly.tsx` and `app/parking-map.tsx`. Finance logic: `lib/finance.ts`. API routes perform Zod validation and role checks. Persistent database: Cloudflare D1 SQLite, both locally and on Sites. Drizzle models: `db/schema.ts`. Future PostgreSQL design and transaction requirements: `db/postgres-schema.sql`. PostgreSQL is not connected.

The API checks exact peak overlapping reservations within one conditional SQL INSERT. Capacity edits use the same peak rule, including already-active intervals. The UI supplies an idempotency key and quoted hourly rate; the server captures current pricing atomically and rejects changed quotes. Mutations and audit events commit together. See the architecture and verification documents below for limits.

## Setup and run

Requires Node.js >=22.13 and pnpm; tested with Node24.19/pnpm11.25. Installation and map tiles require internet. The booking/list interface remains usable without map tiles.

```bash
cd "/Users/dmp/Documents/codex tg/parkly/site"
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

For the existing checkout, use the **Isolated full-stack preview and API tests** commands below first. They create a fresh scratch database and preserve current working records. The normal `pnpm dev` command uses `.wrangler/state` and must not be started against an old schema until backup/preflight and pending migrations are complete.

The normal development URL is `http://127.0.0.1:5173/`; the isolated built preview below uses 5180. Apply each migration only once to a new database. Fictional accounts/listings are inserted on the first API request with `INSERT OR IGNORE`, preserving edits. Local data survives restarts under ignored `.wrangler/state`. Hosted and local data are separate.

Bundled executable paths on this computer:

```bash
export PATH="/Users/dmp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/dmp/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
```

## Checks

```bash
pnpm test
node node_modules/typescript/bin/tsc --noEmit
PARKLY_TEST_URL=http://127.0.0.1:5180 pnpm test:integration
PARKLY_TEST_URL=http://127.0.0.1:5180 pnpm test:pwa
```

The API test requires an explicitly selected loopback server and disposable classroom database. It rejects remote URLs and has no default target. Follow the isolated setup below; do not use your ordinary database for these tests. It creates and cancels fictional bookings, temporarily changes one capacity and restores it. Never run it against production. It tests an eight-request race for one slot, persistence, price, cancellation/rebooking, capacity floors, ownership, approval gates, favorites and invalid dates. Cancelled test history remains.

## Implemented behavior

Search; price/type/current-demo-availability filters; list/map views; geographic zoom/pan; details; selected-time inventory; 1–24-hour booking and review; persistent references; cancellation; history; favorites; profile display name. Operators edit their own prices/capacity, review bookings, utilization and completed allocation. Admin manages account enablement, listing approvals and demo metrics. Financial inputs recalculate revenue, expenses, profit, break-even and chart bars.

EN/RU switching translates core navigation, hero and key booking labels. Secondary dashboard, administration and financial explanations remain English. This is partial Russian localization.

## Demo accounts and limitations

Local loopback requests retain the clearly labelled **demo authentication** chooser. Shared roles never open on LAN or public hostnames. Unconfigured remote hosts allow browsing and reject authenticated mutations. `PARKLY_AUTH_MODE=sites`, configured only behind the trusted Sites gateway, maps verified identities to persistent driver accounts; privileged roles require reviewed server-side assignment. The provider is not configured or deployed by this branch. New demo session tokens are hashed in D1 and use HTTP-only SameSite cookies. This does not provide production password signup, MFA, recovery, rate limits or privacy compliance by itself.

Six listings are fictional; one starts pending approval. Coordinates show approximate areas, not participating facilities. Inventory is simulated. Current availability differs from selected future availability. Book whole-hour slots, 1–24 hours, within 90 days. Prices are captured at booking. Driver cancellation is allowed before start. Operators can cancel their bookings and mark them completed after end. Ended bookings await completion; no automatic no-show classification is claimed.

No bank payment, refund, barrier, sensor, camera, real occupancy feed or actual revenue integration is connected. BPMN exception workflows are proposed service design; not all are automated in the MVP. Use fictional details only. Real Kazakhstan operation needs data-location assessment, suitable hosting, partner contracts and legal/payment/tax review.

## Financial meanings

Modeled bookings are eligible completed bookings. Processing fees apply to full GMV, using the classroom0.95% assumption. Parkly commission is10%; operator allocation90% before its costs. B2B subscription revenue is separate. Dashboard operating results exclude tax, setup, depreciation and financing; XLSX includes setup/cash-flow schedules. Paid B2B accounts should not exceed partners. None of these are observed commercial results.

## Hosting

`.openai/hosting.json` preserves the Site identity and D1 `DB` binding. Use Sites build/source/publication helpers; do not invent database IDs or keys. Hosted migrations apply to a separate database. Keep credentials, local data and `.sites-runtime` outside source archives. Map tiles are attributed to OpenStreetMap; use an appropriate licensed provider or self-hosting before scaling.

## Audit and implementation documents

- [Architecture](docs/ARCHITECTURE.md)
- [Every page and action](docs/PAGE_ACTION_AUDIT.md)
- [Implementation plan and release gates](docs/IMPLEMENTATION_PLAN.md)
- [Requirements and original-ID crosswalk](docs/REQUIREMENTS_TRACEABILITY.md)
- [Verification and limitations](docs/VERIFICATION.md)
- [Environment names](.env.example)

The source changes in this branch are local. Existing `.wrangler/state` and hosted data were not migrated during the audit. Do not run the new application against an old schema until its pending migrations are applied in order. `0000` is unchanged. Apply `0001_booking_foundation.sql` and `0002_database_guards.sql` once to an existing database only after backup/preflight; do not replay `0000` there.

## Isolated full-stack preview and API tests

Build first. Select a **new empty** scratch directory, for example `/private/tmp/parkly-pwa-my-test`. The following commands use only local D1; they do not deploy anything:

```bash
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to /private/tmp/parkly-pwa-my-test --file drizzle/0000_high_gabe_jones.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to /private/tmp/parkly-pwa-my-test --file drizzle/0001_booking_foundation.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to /private/tmp/parkly-pwa-my-test --file drizzle/0002_database_guards.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --local --config dist/server/wrangler.json --persist-to /private/tmp/parkly-pwa-my-test --ip 127.0.0.1 --port 5180 --inspector-port 0
```

In a second terminal:

```bash
pnpm test
pnpm typecheck
PARKLY_TEST_URL=http://127.0.0.1:5180 pnpm test:integration
PARKLY_TEST_URL=http://127.0.0.1:5180 pnpm test:pwa
```

Open `http://127.0.0.1:5180/#/map`. Test history stays in that scratch database. Restart the built preview after rebuilding or changing its binding/asset configuration; do not rely on an in-place reload to refresh the asset manifest. Stop the preview with Ctrl+C. Use a different empty directory for a completely fresh test; never replay migrations into a directory whose migration state is unknown.

## PWA behavior

The website has a manifest, existing-brand PNG icons, standalone shortcuts, service-worker registration and a public offline page. Only explicit public fallback/icon assets are cached. Account/API/booking/availability data, authentication routes, RSC responses and mutations are never cached. There is no offline booking queue or real push delivery. Installation needs HTTPS (or loopback for local development); plain LAN HTTP on an iPhone is not an installation test. Real Safari/Android install and update acceptance remains pending on the approved HTTPS origin. The separate mobile export on port 8082 does not run this website backend.
