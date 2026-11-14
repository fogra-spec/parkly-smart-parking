Educational project for the course Business Analysis, Astana IT University. Not a real product or service. All data are fictional.

# Parkly — localhost course prototype

Source repository: [fogra-spec/parkly-smart-parking](https://github.com/fogra-spec/parkly-smart-parking) (**Private**, default branch `main`). This is the source code repository, not a live website.

Parkly demonstrates parking search, individual-space reservations and assigned-operator management using invented accounts, facilities and reservations. Availability is reservation inventory, never sensor occupancy. No real parking access, payment, refund, partnership or collected revenue is represented. Do not enter real personal information or card details.

The professor's latest prototype restrictions override the attached master prompt's mandatory cloud hosting. This version runs on **127.0.0.1 only**. Do not publish or advertise the running prototype, start a public tunnel, or use a service requiring a payment card or paid plan. A private GitHub source repository is authorized for this task; no website deployment is authorized. Hosting adapters are provided for a separate future deployment decision.

## Run locally

Requires Node.js **24+**, pnpm and a supported native PostgreSQL platform (verified on macOS arm64). Dependencies are already present in this checkout; for a fresh checkout:

```bash
cd parkly-smart-parking  # cloned repository root
pnpm install --frozen-lockfile
cd backend
pnpm install --frozen-lockfile --ignore-scripts
cd ..
pnpm dev:fullstack
```

Open **http://127.0.0.1:5173**. The launcher starts PostgreSQL on 55432, the Node API on 5191, the reminder worker and the website on 5173. All listeners use loopback. Ctrl+C stops them; the database survives in ignored `backend/.local/`. Do not run two launchers on the same database or delete it to fix startup errors.

The launcher applies checksum-tracked migrations in `backend/migrations/` and seeds fictional facilities only on initial setup. Later starts preserve records. No cloud account or Supabase configuration is required. The existing native PostgreSQL/auth implementation is retained instead of migrating to Supabase: salted scrypt passwords, opaque HttpOnly sessions, database RLS and restricted service roles are functional locally.

## Fictional test accounts and secrets

Public registration is disabled in the UI and server. Sign in with:

| Email | Role | Scope |
|---|---|---|
| `driver@test.local` | Driver | Own reservations, favorites and notifications |
| `operator@test.local` | Operator | North Parking fictional facilities only |

Random passwords are generated once. Open **`backend/.local/.env` locally** and inspect `PARKLY_FIXTURE_ACCOUNTS` to get the matching password. Do not paste this file into chat, screenshots, Git, archives or the demo video. It also contains private fixture admin/second-operator credentials, database URLs and VAPID/encryption keys. File permissions are 0600. Older local JSON secret files are migrated into this `.env` without resetting the database.

`.gitignore` ignores `.env*` except placeholder-only `.env.example`; `backend/.gitignore` also ignores all `.local/` data. There are no source-code passwords. Keep additional credentials in ignored `.env` files. Never use `git add -f` on them. If a real credential is committed, rotate it immediately and tell the project owner; deleting the file from the latest commit is insufficient.

Local defaults are generated automatically; see [.env.example](.env.example) and [backend/.env.example](backend/.env.example) for variable names. Backend URLs, passwords, encryption and VAPID private keys must never use `NEXT_PUBLIC_`/`VITE_` prefixes. No real payment provider is configured: confirming a booking changes a stored reservation state and charges nothing.

## Main demonstration

1. Sign in as the fictional driver. Search by area and filter price/type/availability.
2. Open an approved fictional facility and select a future interval, floor and space.
3. Hold the space, review the KZT quote and confirm. A unique reference is stored in PostgreSQL.
4. In a separate browser session, sign in as the operator and find the same booking.
5. Cancel as the driver before arrival; the allocation is released and history/notifications persist.

The server validates quotes, dates, permissions and idempotency. PostgreSQL locks and an exclusion constraint reject overlapping active allocations on the same space; reducing capacity cannot hide existing claims. Operators are restricted to assigned organizations. Extra workflows include extensions, layout editing, manually recorded parking sessions, fictional reports, support, preferences and administrative controls.

## Web Push and PWA

Local startup generates VAPID and encryption keys in `.env` and runs the durable PostgreSQL reminder worker. In account settings, explicitly enable notifications on a supported desktop browser and allow the browser permission. No permission prompt runs automatically. Subscriptions are encrypted, session-bound and revocable; retries and expired endpoints are handled server-side. The in-app Notification Center works without push permission.

Manifest, icons, service worker and offline fallback are included. The durable sender handles driver end-time reminders. Immediate confirmation/cancellation messages currently appear in-app; immediate booking-change pushes for both roles remain master-prompt work. Automated subscription/queue/service-worker tests are distinct from actual device delivery. **Physical-device background delivery and iPhone installation have not been verified in this task.** iPhone push requires an installed Home Screen PWA on supported iOS/iPadOS and an appropriate HTTPS origin. A phone cannot reach this computer through its own localhost. Do not expose the prototype publicly to perform that check. See [notification evidence and manual steps](docs/NOTIFICATIONS_DEPLOYMENT.md); its production hosting sections are historical, outside the current local-only scope.

## Verification

```bash
pnpm typecheck
pnpm backend:typecheck
pnpm check:repository
pnpm lint
pnpm test
pnpm backend:test
PARKLY_BACKEND_URL=http://127.0.0.1:5191 pnpm build
# With pnpm dev:fullstack running:
PARKLY_TEST_URL=http://127.0.0.1:5173 node tests/fullstack.integration.mjs
PARKLY_TEST_URL=http://127.0.0.1:5173 pnpm test:pwa
```

Backend tests create isolated temporary PostgreSQL clusters with invented fixtures. Registration is enabled explicitly only in those test instances to test its historical implementation; the ordinary launcher and hosting adapter disable it by default. The website bridge test uses the pre-provisioned local driver and leaves clearly fictional QA records. It never connects to a hosted database. Legacy `test:integration` targets the older D1 adapter and is not the PostgreSQL workflow check.

The full-stack prototype and GitHub preparation are separate from a website launch. For the private repository handoff, current verification, professor access and team contributions, see [GitHub setup](docs/GITHUB_SETUP.md). For a future Vercel import and optional Supabase PostgreSQL provisioning, see [Vercel preparation](docs/VERCEL_DEPLOYMENT.md). `pnpm build:vercel` builds the reused React UI to `dist-vercel`; `api/parkly.ts` serves the same tested PostgreSQL business operations on Vercel. This is a Vite/Node Functions target, not a claim that the existing Cloudflare build is a native Next.js deployment.

See [current course scope, acceptance evidence, diagrams and demo script](docs/COURSE_PROTOTYPE.md), [current requirements matrix](docs/COURSE_RTM.md) and [baseline mapping](docs/REQUIREMENTS_TRACEABILITY.md), [architecture](docs/ARCHITECTURE.md), [API](docs/API.md) and [backend details](backend/README.md). Earlier verification/deployment documents describe previous work; the current course scope takes precedence.

## Open-source and asset credits

The existing Sites/Vinext starter and generated component scaffold are retained. Principal components: React, Next.js, Vinext, Vite, Tailwind CSS, Base UI, Radix/shadcn components, Recharts, Zod and node-postgres (MIT); Lucide (ISC); Drizzle ORM and class-variance-authority (Apache-2.0); TypeScript (Apache-2.0); web-push (MPL-2.0); embedded-postgres (MIT); embedded PostgreSQL (PostgreSQL License). Cloudflare tooling is MIT/Apache-2.0 as specified in its packages. Preserve upstream copyright and license files when redistributing. A [local license inventory](docs/THIRD_PARTY_LICENSES.md) records installed direct dependencies and their notice files.

Map data © OpenStreetMap contributors, ODbL; map attribution is visible in the map. Existing Wikimedia Commons area photos credit their authors and CC BY-SA/CC0 licences in [the asset manifest](public/photos/credits.json) and Help → Photo credits. They show nearby landmarks, not parking entrances or partnerships. Share-alike terms continue to apply to relevant cropped/adapted photos. No replacement imagery was added.

## Known limits and academic deliverables

No website deployment, real payments or production readiness is claimed. GitHub upload status is recorded separately in `docs/GITHUB_SETUP.md`. The stack is Next-compatible React/App Router on Vinext/Vite with a separate Node PostgreSQL API, rather than the master prompt's requested Supabase-managed auth/Next Route Handler-only architecture. Existing code and persistent records are preserved. Email verification/recovery, real-device acceptance, full mobile accessibility QA and production operations remain outside this local course demonstration.

Business report, workbook, BPMN and slides are tracked in `public/project/`. The original `../deliverables/` directory exists only in the author's surrounding local workspace and is not required by a clone. Existing FR identifiers are preserved; [the mapping](docs/REQUIREMENTS_TRACEABILITY.md) distinguishes implemented functionality from remaining work. No usability participants or results have been invented.

**University OneDrive demo video URL: [TO BE ADDED AFTER RECORDING]**
