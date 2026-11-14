# Requirements traceability

Baseline: user's current PostgreSQL mission, earlier FR-01–FR-07 requirements, and preserved `public/project/requirements.csv`. A separate SRS was not supplied; the later smartphone floor-map screenshot was inspected and used as a UI reference. “Implemented” means working persistent local PostgreSQL with fictional facilities, not an approved live parking service.

| ID | Requirement / measurable acceptance | Implementation | Verification/status |
|---|---|---|---|
| FR-01 | Search approved parking by case-insensitive name/area | Existing `lib/parking.ts`, website search; database projection and `/api/v1/facilities` in `backend/src/router.ts` | Existing search tests; resource endpoint validates query/pagination; SQL search optimization remains |
| FR-02 | Combined price/type/available filters respect exact boundaries | Existing filter controls/rules; availability derived from DB allocations | Search/filter unit tests; fictional source retained |
| FR-03 | View concrete spaces, KZT price, hours, rules and source | `app/parkly.tsx`, facilities/floors/spaces/pricing tables, `available_spaces` | Browser selected Ground S-0002; hours/rules come from DB; occupancy always not_available |
| FR-04a | Hold/confirm one future 1–24h interval within 90 days; repeat key creates one reference | Migrations 001/004; holds/allocations/reservations; router and booking dialog | Two-user race, six identical hold retries, confirmation replay, browser booking |
| FR-04b | Only owner/assigned staff cancels; records/history retained; retry harmless | `cancel_reservation`, action_requests, status triggers; driver/staff buttons | Owner isolation, repeat cancellation, browser history |
| FR-05 | No unreleased overlapping claims for one space, including holds/maintenance | GiST exclusion on `[start,end)`, per-space locks and atomic transactions | Race gives one success/one conflict; direct privileged overlap insert rejected; adjacent ranges succeed |
| FR-06 | Operator manages only membership facilities; capacity nonnegative; held spaces cannot disappear | Memberships/RLS, checked inventory/floor/space/block functions; `operator-tools.tsx` | Cross-tenant 403, driver 403, maintenance overlap/capacity floor tests; onboarding test |
| FR-07 | Authorized history/report; completed GMV distinct from commission/operator allocation | RLS booking projection; `/reports` aggregates all authorized records; `server-reports.tsx` | Completed 400 KZT fixture gives estimated 40 KZT commission; other org sees zero; no real settlement |
| FR-08 | Interactive Astana map, selection and usable list alternative | Existing `app/parking-map.tsx`, geographic OSM tiles/attribution | Existing UI preserved; no verified partners/occupancy; touch/geocoder/clustering remain |
| FR-09 | One staff-recorded parking session per reservation; driver sees only own | `record_session`, unique reservation FK, sessions table; check-in/out buttons and driver panel | Driver/foreign staff rejected; assigned check-in/out and repeated checkout pass |
| FR-10 | Extension adds price/history atomically; conflict leaves original unchanged; key retry stable | `extend_reservation`, allocation constraint, reservation_extensions/action_requests; +1h UI | Blocked extension fails; successful repeated extension charged once; browser 800→1,200 KZT |
| FR-11 | Durable preferences/subscriptions/event history with honest delivery status | Notification tables, trigger outbox/status, subscription/preference/read APIs, driver panel | Durable worker, encrypted Web Push, explicit opt-in, preferences/unsubscribe and attempt history implemented; actual invalid-endpoint HTTP 410 tested; native device display pending |
| FR-12 | Secure login/logout/session; course accounts pre-provisioned, no public registration | `auth.ts`, `http-handler.ts`, `password.ts`, auth SQL functions; PasswordAccount | Default signup 403; driver@test.local/operator@test.local login; hash/salt, invalid password, logout and disabled-session tests. Historical signup runs only in explicitly configured isolated tests. |
| FR-13 | Admin organization/access/approval changes validated and audited | Admin SQL functions; `admin-access.tsx`; existing admin controls; `/admin/audit` | Driver admin request denied, onboarding approval/membership tests; self/last-admin guards in SQL |
| FR-14 | Own profile/favorites persisted, no business localStorage | `compat.ts`, narrow grants/RLS, existing UI | Retained server calls; localStorage only language; broader profile/contact model not added |
| FR-15 | Classroom finance scenarios retain independently checked values | Existing `lib/finance.ts`, dashboard/downloads | Four finance tests; no actual revenue assertion |
| FR-16 | KZT/UTC storage/Asia-Almaty display; EN/RU option | timestamptz, UTC transactions, Intl display and existing labels | Browser local dates verified; secondary strings still English |

## Non-functional and database requirements

| ID | Acceptance / code | Evidence / remaining limit |
|---|---|---|
| NFR-AUTHZ | All app tables RLS; service login non-owner/NOBYPASSRLS; writes checked server and SQL | Direct foreign-user SELECT returns zero; direct reservation UPDATE denied; unsafe owner startup rejected. Trusted API identity setting remains a service boundary |
| NFR-CONSISTENCY | Holds/reservations/maintenance share one DB constraint; no check-then-write race | Fresh real PostgreSQL API and direct SQL tests; cancellations/extensions transactionally recorded |
| NFR-EXPIRY | Server expires five-minute holds and ended reservations without active sessions | 15s bounded sweep and on-demand cleanup; forced-time test gets 410 with committed release/history |
| NFR-HISTORY | Immutable original agreement, complete state transitions and append-only operational audit | Status/audit triggers, extension line items, no raw secret payloads in audit |
| NFR-VALIDATION | Strict UUID/number/enum/JSON/origin/body contracts; structured errors/request IDs | HTTP tests for 400/403/413/415; SQL conflict 409; availability outage 503 |
| NFR-PRIVACY | Hashed passwords/tokens, private cookies/no-store, no client DB credentials | Authentication tests, ignore rules and bridge; email verification/recovery/MFA/legal retention remain |
| NFR-MIGRATION | Ordered transactional checksum migrations and indexes, no per-request schema creation | `backend/scripts/migrate.ts`; fresh twelve-file install repeatedly tested; existing D1 unchanged |
| NFR-PWA | Existing manifest/icons/public offline fallback, never offline business confirmations | Existing worker unit/HTTP tests; actual Safari install/update/device push not verified |
| NFR-UX | Preserve visual identity/navigation, responsive controls/error/loading states | Booking E2E and phone history check; full WCAG/touch/device audit remains |
| NFR-TEST | Real DB race/authorization/time-window tests plus root regressions and browser flow | `backend/tests/postgres.test.ts`, root tests and verification record |
| NFR-DEPLOY | Reproducible local full stack, separate runtime/owner credentials, approved remote TLS/key | Backend README/API docs; no deployment. Managed hosting, CI, backup/restore/load/security release gates remain |

All requested entities map to `backend/migrations/001_core.sql`; policies to 002; auth to 003/006; booking/expiry/extensions to 004; inventory/sessions/admin to 005; structured layouts/drafts/publication and inventory gates to 007/008. The older `db/postgres-schema.sql` is not used by the launcher.

Original classroom CSV IDs remain unchanged: current FR-01→FR-002; FR-02→FR-004; FR-03→FR-005; FR-04a/05→FR-006; FR-04b→FR-008; FR-06→FR-009/010/012; FR-07→FR-011/013; FR-08→FR-003; FR-12→FR-001/014; FR-13→FR-015; FR-14→FR-016; FR-15→FR-018; FR-16→FR-017. Sessions/extensions/push expand that baseline. Real payments/barriers remain future approved integrations.

## Floor-map requirements

| ID | Acceptance | Code / evidence |
|---|---|---|
| FR-17 Floor selection | Backend floors/bays, exact interval quote/availability, floor switch, pan/zoom, labels, legend and accessible list | `floor-booking.tsx`, `floor-canvas.tsx`, `backend/src/floors.ts`; browser Ground/Floor 2/Floor 3 and A-14 booking |
| FR-18 Operator map editor | Assigned organization only; create floor/space; move/rotate/label/reservable controls; layout features; persistent draft/preview/publication | `floor-editor.tsx`, migrations 007/008; UI created/published A-12/A-14/B-14 and unavailable A-13; version/tenant/geometry tests |
| NFR-MAP-01 | Unknown IDs, duplicate labels, out-of-bounds rotations and stale draft versions rejected; unpublished spaces cannot be booked | PostgreSQL/API tests, including 500-space document over the standard body limit; geometry/zoom unit tests |

Real multitouch/pinch behavior on iPhone/Android still needs device QA. The pointer implementation and math tests do not certify a physical-device gesture test.

## Reminder and session mission

| ID | Acceptance and implementation | Verification |
|---|---|---|
| FR-19 Server reminders | 30/15/5/end jobs are persisted at booking time; per-user preferences; no browser scheduling | Migrations 009/010, reminder-worker.ts, reminder-api.ts; compressed four-second fixture expired on the real worker timer |
| FR-20 Safe delivery | Unique claims, leases, bounded retries/TTL, attempt logs, 404/410 cleanup, encrypted endpoint data | Concurrent worker, replacement worker, unknown-ack lease, endpoint cleanup and actual encrypted HTTP 410 tests |
| FR-21 Browser push | User-click permission only; device unsubscribe; SW capability validation, persistent deduplication and protected deep link | Five SW/IndexedDB tests plus live settings UI; actual OS delivery/iOS installation not certified |
| FR-22 Session and extension | Own location/floor/bay, UTC/Asia-Almaty times, countdown/status; server options/quote and atomic extension/reminder reschedule | API collision/quote/idempotency tests and browser 800→1,200 KZT extension + refresh/deep link |

The API and worker are implemented; production hosting/secrets provisioning, actual subscribed-device presentation and backup/restore acceptance remain deployment gates. See NOTIFICATIONS_DEPLOYMENT.md.

## Workspace completion requirements

| ID | Requirement | Code / persistent enforcement | Verification |
|---|---|---|---|
| FR-23 | Complete searchable own/managed booking history and confirmation | booking-history.tsx, workspaces.ts, summary.ts; RLS | 205-record pagination/aggregate test; website bridge booking flow |
| FR-24 | Private support conversations | support-center.tsx, migration013 support tables/functions | Cross-user/operator rejection, reply retry, resolution/reopen |
| FR-25 | Operator application and approval | operator-application.tsx, admin-operations.tsx, migration013 | Concurrent approval creates one organization, admin-only decision |
| FR-26 | Assigned listing rules and metadata | operator-tools.tsx, edit_facility | Foreign operator edit rejected; value persists |
| FR-27 | Notification center/read actions | notification-center.tsx, scoped notifications API | Own read persists, foreign read rejected |
| FR-28 | Administration audit/status/users | admin-users.tsx, admin-operations.tsx, workspaces.ts | Role checks, paging, operational query |
| FR-29 | Password settings and revoke sessions | password-settings.tsx, auth.ts/server.ts, migration014 | Wrong password rejected, old sessions revoked, new login succeeds |
| FR-30 | Accessible workflow navigation/help/reporting | workspace tabs/mobile nav, help-page.tsx, server-reports.tsx | Type/lint/build/API pass; manual visual/device acceptance pending |
