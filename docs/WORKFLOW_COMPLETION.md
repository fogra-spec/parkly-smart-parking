# Parkly workflow completion — 30 October 2026

This update extends the existing website, PostgreSQL service and visual identity.
It preserves the native mobile project, historical D1 data, educational financial
model and project downloads. It does not certify a production launch.

## Delivered and connected

| Experience | Implementation and persistent source |
|---|---|
| Home/map/details | Existing DB facilities, filters, interactive map and exact-interval floor layout preserved; facility hash links survive refresh |
| Reservation confirmation | Server hold → atomic confirmation → booking reference and protected session deep link |
| My Bookings | Dedicated driver navigation; own upcoming/active/past history, search and pagination; all-date SQL metrics |
| Booking details | Protected reference, floor, space, arrival/departure, status timeline and extension history |
| Cancellation/extension | Inline cancellation review, idempotent cancellation, server-priced extensions and reminder rescheduling; operator check-in/out retained |
| Saved parking | Existing own-user persistent favorites, dedicated view and useful empty state |
| Notifications | Dedicated paginated center, protected booking links, persistent read actions, existing Web Push preferences/device/attempt controls |
| Profile/settings | Display name persistence; authenticated password change, all-session revocation and reauthentication |
| Help/policies | Reachable Help navigation; cancellation, inventory, pricing, extension, installation, notification and privacy explanations |
| Support | Persistent own-user cases, idempotent messages, admin replies/status, resolution and reopening; no external email sent |
| Operator access | Persistent application → admin review → organization/membership/role transaction; safe concurrent review retries |
| Operator inventory | Existing floor/space/layout/maintenance/capacity/versioned hourly pricing retained; assigned-only listing/address/rule editing added |
| Operator reporting | Uncapped SQL counts, created-date filters, CSV export; GMV, estimated commission and operator allocation distinguished |
| Administration | Searchable paginated users/audit, operator reviews, facility moderation, support queue and server operational status |
| Responsive UI | Consistent cards/forms, touch controls, driver tabs, mobile bottom navigation, focus rings and reduced-motion support |

All mutable workflows use authenticated same-origin API calls and validated server
operations. Guest facility discovery is deliberately public. RLS restricts users,
operators and support cases. New tables have no direct runtime write grants.
Approval is an application access/moderation decision, not a verified commercial
agreement. Inventory remains explicitly fictional/operator-entered, with no verified
physical occupancy. Reservation expiry never implies vehicle departure.

## Database and API additions

- `013_workspaces.sql`: operator applications, support cases/messages, RLS,
  indexes, audit and checked access/review/reply/listing/system-status functions.
- `014_password_settings.sql`: checked password update and session revocation.
- A clean private cold backup of the existing PostgreSQL data/runtime was saved
  before applying these additive migrations. No database reset/import occurred.
- API modules: `backend/src/workspaces.ts` and `backend/src/summary.ts`.
- `GET /dashboard`: own all-date metrics; assigned operations/admin metrics by role.
- `GET /reservations`: scope, bucket, reference/facility/space search and pagination.
- `GET /reports`: server aggregate, optional start/end/facility filters; interval
  uses reservation **creation** time and a half-open range. CSV states its units.
- `GET/POST /operator-applications`, admin `PATCH /admin/operator-applications/:id`.
- `GET/POST /support`, `GET /support/:id`, `POST /support/:id/messages`.
- `PATCH /operator/facilities/:id/details`.
- `GET /admin/users`, `/admin/audit`, `/admin/system`.
- `POST /auth/password`, paginated `GET /notifications`; existing read action.

Paginated collections return `total`; list pages use 20 rows (audit 25). Compatibility
state still exposes the latest 200 detailed bookings/users for legacy consumers;
new history and metrics do not derive totals from that projection. Support threads
are bounded to 500 messages per response. Notification test-booking selection is
bounded to 200 active/upcoming own reservations.

## Financial meaning

Completed reservation GMV comes from stored completed reservation values. Estimated
Parkly commission = completed GMV × 10%; operator allocation = GMV × 90%, before
operator costs. The rate is a classroom assumption. No payment, settlement, cost
ledger or actual collected revenue exists. The separate financial simulation still
uses explicitly editable assumptions and is not an operational revenue dashboard.

## Verification

- Website unit tests: 17 passing.
- Backend/service-worker integration suite: 41 passing, no skips. Includes six
  new workflow subtests (plus their parent test); totals include nested tests.
- New tests cover support ownership, reply retries, review concurrency, foreign
  operator rejection, 205-record history/aggregates, private notifications, admin
  status/audit and password/session revocation.
- Website HTTP-to-PostgreSQL integration: 21 steps passed with a new synthetic QA
  account. Hold, confirm, extend, cancel/retry, favorites, profile, support,
  notifications and persistence after logout/login were exercised. The test
  reservation is cancelled; clearly named QA records remain for audit.
- Public-preview security/PWA/auth smoke test: 19 checks passed after restoring the
  temporary tunnel; all seven referenced compiled JavaScript/CSS assets also loaded. PWA MIME/cache checks: five passed.
- Both TypeScript projects, application lint (zero warnings) and production build
  passed. Client artifact scan found no actual private VAPID/encryption/DB keys.
- Browser inventory was available, but browser-tab automation failed in this
  session. No new screenshot, visual acceptance, browser-click E2E, screen-reader
  or physical iOS/Android delivery result is claimed.

The PWA lint command scopes the website/backend and excludes the independent native
mobile package and generated exports. Runtime React hook rules remain enabled.
Compiler migration diagnostics are scoped out for legacy imperative map/clock/effect
components because this Vinext app does not enable React Compiler. New components
retain the normal configured rules. Heterogeneous negative-test wire fixtures have
a test-only `no-explicit-any` exception.

## Remaining release limits

- Temporary Cloudflare preview requires the Mac/network/processes to remain up;
  the old hostname was removed by Cloudflare and a fresh link was created. A later transient HTTP530 cleared after the tunnel reconnected; the final public checks then passed. A fixed
  managed API, PostgreSQL, worker and HTTPS domain are still required for 24/7 use.
- Email verification, recovery, privileged MFA, self-service account deletion and
  reviewed privacy/retention policies remain production work.
- Business-hours enforcement and advanced time-dependent pricing are absent;
  published hours/rules are operator-entered information. Hourly versioned pricing
  is implemented. Geocoding, production map-provider arrangements and scale tuning
  remain outside this release.
- No staffed support SLA, sensors/barriers, physical occupancy verification, real
  payments/refunds, settlement or verified partnerships.
- Full Russian translations, real-device PWA/install/push acceptance, accessible
  gesture testing, independent security/load review and restore rehearsal remain.
- The root hash-workspace component remains large; new workflows are extracted
  into reusable components/hooks, but a full page/module split is deferred to avoid
  a disruptive rewrite during functional completion.

## Run/check

```sh
pnpm dev:fullstack
pnpm typecheck
pnpm backend:typecheck
pnpm lint
pnpm test
PARKLY_PUSH_NETWORK_TEST=1 pnpm backend:test
PARKLY_BACKEND_URL=http://127.0.0.1:5191 pnpm build
PARKLY_TEST_URL=http://127.0.0.1:5173 node tests/fullstack.integration.mjs
PARKLY_TEST_URL=http://127.0.0.1:5173 node tests/pwa.integration.mjs
```

The fullstack HTTP test deliberately writes only a new fictional QA account and
its own records; it should not be run against a production system. See
`PUBLIC_PREVIEW.md` and `NOTIFICATIONS_DEPLOYMENT.md` for hosting boundaries.
