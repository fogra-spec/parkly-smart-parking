# Implementation status and release plan

Updated 28 October 2026. The user's PostgreSQL mission is implemented locally; this is no longer a schema-only proposal. Preserve the existing website/mobile app and both legacy D1 and new PostgreSQL data directories.

| Workstream | Delivered | Remaining production work |
|---|---|---|
| Architecture audit | Existing UI, hash routing, styles, API, D1 persistence/auth, operators/admin, PWA/runtime, environment/dependencies reviewed; per-action audit maintained | Reconcile separate SRS when supplied; incrementally extract large view |
| PostgreSQL | Twelve checksum-tracked transactional migrations; all requested entities, FK/check/exclusion constraints, indexes and row policies | Managed database/provider selection, sizing, backup/PITR and restore drill |
| Authentication | Driver-only signup, scrypt hashes, hashed opaque sessions, secure cookie policy, logout/disable revocation, durable rate limiting and audit | Email verification, recovery, privileged MFA, reviewed retention/abuse policy |
| Authorization | Runtime non-owner role, RLS, checked mutations, organization memberships, roles and admin controls | Independent security review, privileged-access review and monitoring |
| Booking | Individual space selection, five-minute holds, confirmation, durable history, cancellation/extension idempotency and exclusion constraint | Retry policy for rare serialization conflicts; production load/failover validation |
| Inventory | Persistent floors/spaces, versioned hourly rates, safe capacity adjustment, maintenance blocks, pending facility creation/approval | Operating-hour calendar/time-dependent pricing UI, contracts/source freshness checks |
| Parking sessions | Assigned staff check-in/out and driver history; source explicitly operator-recorded | Overstay/dispute operations policy; barrier/sensor integrations only after approval |
| Notifications | Encrypted devices, customizable checkpoints, durable jobs/leases/attempts, real Web Push transport and service-worker deduplication | Approved HTTPS production hosting, real-device/OS acceptance, operational monitoring and outage tests |
| Reporting | Authorized history plus database aggregate report over all authorized records; completed demo GMV and 10% estimate separated | Period filters, exports, reconciliation, settlement/accounting ledger; detailed lists currently capped at 200 |
| Website | Existing navigation/design/finance/downloads retained; new components wired to server; phone booking history made readable | Full Russian catalog, screen-reader audit, touch map/device installation and broader E2E automation |
| Deployment | Frozen dependency files, isolated test cluster, setup/API docs and fail-closed HTTP bridge | Approved hosting, HTTPS secrets/ingress, CI, migration/release/rollback rehearsals |

## Safe sequence for a real environment

1. Approve hosting/data-location, privacy/retention and partner policies before collecting real details. Allocate separate staging/production PostgreSQL and API services. Do not use the local fixture launcher in production.
2. Back up any existing database and rehearse restore. Provision a trusted migration owner; enable `btree_gist`; apply immutable `backend/migrations/` using that owner. Provision a separate non-owner runtime login with only `parkly_app` membership. Test startup role checks.
3. Bootstrap the initial admin with a reviewed out-of-band owner operation. Use application admin/membership APIs for subsequent access. Do not seed production fixtures or reuse generated local credentials.
4. If migrating D1 records, first inventory/export existing rows without changes, map account identities and organizations, map aggregate lots to concrete spaces, reconcile intervals/prices/references, dry-run and obtain review. There is no automatic import in this branch; old data is untouched.
5. Deploy an API staging service behind TLS and restricted ingress. Configure exact public origin, restricted DATABASE_URL with `sslmode=verify-full`, and a server-only backend key. Configure the same key and HTTPS backend URL on the Worker. Do not put keys in Vite public vars/source.
6. Run isolated tests, staging authorization/race tests and real-device PWA checks; benchmark API/query costs and failure behavior. Confirm private responses cannot be cached or served between users.
7. Add email verification/recovery and admin MFA, retention cleanup, request/error monitoring, expiry sweep health and backup alerts. Verify push stays disabled until its delivery path is approved and tested.
8. Review a concrete release and migration plan, then request production approval. No deployment or hosted migration is authorized by the current implementation task.

## Current architectural limits

Search/filter views read database records and filter the current dataset in the browser. The resource search endpoint validates and pages its response but currently filters the authorized projection in Node; database search/index tuning remains scale work. Availability expiry checks lock space rows conservatively and need production contention measurements. Detail/history responses are bounded; the aggregate report is not capped to that history. Forecast/financial inputs remain transient classroom UI assumptions by design.

The local native PostgreSQL package is pinned to an 18.4 beta-labelled package release; production should use a supported managed/server PostgreSQL release, not that dev launcher. Vinext is also beta; runtime/cookie/assets behavior needs staging coverage. No production certification, performance claim or tax/payment compliance claim is made.

The interactive floor-map extension is implemented with SVG coordinates and persistent, versioned operator drafts/publication. Backend tests cover stale drafts, tenant access, duplicate/out-of-bounds input, unpublished booking rejection and 500-space saves. Remaining map release work: actual iPhone/Android pinch/drag and screen-reader acceptance, measured rendering/load performance, layout survey/source validation and production geospatial/provider policies.

## 30 October workspace update

Fourteen immutable migrations are now applied locally. See
`WORKFLOW_COMPLETION.md` for the superseding delivered workflows, checks, public
preview boundary and remaining production gates. Reporting dates/CSV, admin
audit/status/support, operator review and password settings are now implemented.
Detailed booking history is paginated; all-date dashboard totals use SQL aggregates.
