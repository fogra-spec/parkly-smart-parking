# Existing page and action audit

Updated 28 October 2026. One existing React page uses hash workspaces; details/review/account are dialogs. Current PostgreSQL mode is selected with PARKLY_BACKEND_URL. No page was recreated. Existing mobile source and D1 data remain intact.

| Page/action | Existing behavior retained | PostgreSQL connection / current result | Remaining limit |
|---|---|---|---|
| Home/header/footer | Hero, destination search, benefit sections, featured locations, FAQ, EN/RU and project downloads | Facilities loaded from DB through `/api/demo` compatibility projection; search opens existing map | Featured/benefit copy remains classroom positioning; no verified partner claims |
| Navigation | Home/map/driver/operator/admin/finance; Back/Forward/reload | Hash routes retained; role guards use server-returned roles | Views remain one large page; deep facility links not implemented |
| Search/filter | Case-insensitive name/area, max price/type/available, reset and list toggle | Persistent facility/rate/inventory records; API query contract also exposed | No geocoding; UI filters loaded records; resource search needs SQL scale optimization |
| Interactive map | Geographic Astana tiles, markers, zoom/pan, attribution/list alternative | Markers show approved fictional DB listings and derived allocation counts | Physical occupancy unavailable; no sensor/provider guarantee; touch/pinch/clustering pending |
| Parking details | Existing modal, price/duration/time, amenities and conditions | DB hours/rules and concrete floor/space picker; availability errors disable review | Fixtures use default 24h calendar; time-dependent business hours not enforced |
| Reservation review | Existing price panel and confirmation | `/holds` atomically claims selected space for 5 minutes; server quote/countdown shown | Requires online server; browser countdown is not authoritative |
| Confirm reservation | Existing driver dashboard transition | `/holds/:id/confirm`; real reference, agreement, allocation, history and event rows | No card/payment/refund; only fictional inventory |
| My bookings | Upcoming/active/past/all, reference/time/total, history | RLS-scoped persistent rows, readable phone cards; cancel and +1h extension APIs with retry keys | Detailed latest-record projection capped at 200; “active now” is time-active booking, not verified vehicle presence |
| Resume/release hold | New panel within existing driver workspace | Persisted own active holds can be confirmed/released after reload | Holds expire on server; no offline queue |
| Parking sessions | New driver panel and staff booking actions | Assigned operator records check-in/out; own sessions persist | Manual operator source, no barrier/sensor verification or automated overstay enforcement |
| Favorites/profile | Existing heart/display-name controls | Own-user SQL/RLS writes; server persistence | No vehicle/contact verification model |
| Account | Existing dialog and visual treatment | Password signup/login/logout, safe errors/loading; driver-only registration; no shared role picker in PG mode | No email verification, recovery or MFA yet |
| Operator overview | Existing capacity/booking/estimated revenue/utilization cards | Organization membership replaces one-user lot ownership; reads scoped by RLS | Existing overview cards use loaded recent records; new server report covers all authorized records |
| Inventory/pricing | Existing forms | Checked transactions safely activate/deactivate concrete spaces and add pricing versions | Hourly rate only; no dynamic tariff calendar |
| Operator structure/maintenance | New expandable tools in same workspace | Create floors/spaces, block/release space ranges; create pending fictional facility | No deletion of historical inventory, unverified physical occupancy |
| Booking and revenue report | Existing history plus new report panel | SQL aggregates all authorized reservations; completed demo GMV and estimated 10% commission/90% operator allocation | No tax/settlement/financial ledger; no collected money; period/export UI pending |
| Administration | Existing account/listing/booking/KPI panels | Server-only enable/disable, approval and access; new organization/membership/role controls | No production bootstrap endpoint or privileged MFA; full audit viewer is API-only |
| In-app notifications | New own-user preferences and recent events | Preferences/delivery history and read endpoint persisted | Web Push worker, encrypted device storage, explicit opt-in, unsubscribe and actual attempt history implemented; real-device display remains unverified |
| Finance simulation | Existing inputs/scenarios/charts and downloads | Existing tested classroom model unchanged; intentionally transient assumptions | Does not store real transactions or imply observed revenue |
| PWA install/offline | Existing manifest, icons, standalone shortcuts, status and fallback | Public-only service worker; APIs/account data never cached | Real-device install/update remains unverified; no offline booking |

## Server/API and environment audit

The former D1 API was persistent but used shared local identities, aggregate lot capacity and no per-space holds/sessions. It remains preserved as a legacy adapter. PostgreSQL mode now uses a separate real database with secure accounts, team membership/RLS, constrained space claims and checked operations; a configured backend failure cannot silently fall back. No localStorage or hardcoded reservation array was introduced. Seeds are explicitly fictional and used only for initial local development records.

The runtime is still Vinext/Vite/Cloudflare with ASSETS/D1 bindings preserved. PostgreSQL requires a separate Node service; remote URLs use TLS and a backend key. `.env.example` files contain names/placeholders only. Credentials, native database files, dependencies and outputs are ignored. Existing `.wrangler/state` was not reset or migrated. Native mobile auth/data remain their prior separate demo implementation; this website task does not claim that mobile is connected to the new backend.

See ARCHITECTURE, API, IMPLEMENTATION_PLAN and VERIFICATION for exact security boundaries and release gates.

## Floor-map addition

Parking cards now open a full-screen SVG floor selector in PostgreSQL mode. It preserves the Parkly header/teal-neutral identity and adds floor tabs, individual space labels, driveways/entry/exit, exact arrival/departure, source status, backend quote, server hold countdown and mobile bottom navigation. The earlier D1 detail dialog remains available in legacy mode.

Operators have a separate expandable map editor in the existing dashboard, with numeric/drag movement, rotation, labels/reservability, feature editing, floor/space creation, versioned draft save, preview and explicit publication. Temporary maintenance remains connected to the existing constrained block APIs. Native mobile and production services were not changed.

## Superseding workflow completion — 30 October 2026

The current action matrix and remaining limits are in `WORKFLOW_COMPLETION.md`.
New paginated booking details/search, driver subviews, help/support, operator
applications/admin review, listing-rule editing, notification read actions,
password settings, date-filtered CSV reports and admin audit/status now replace the
corresponding earlier pending/API-only items. Header access copy no longer asks a
password user to choose a demo role. Metrics use uncapped database aggregates.
No visual browser acceptance is claimed for this update because the browser-tab
connection was unavailable; API, build, lint, type and automated checks are recorded.
