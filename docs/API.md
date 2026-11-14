# Parkly application API

Base path: `/api/v1`, accessed through the existing website origin. PostgreSQL mode must be configured. Requests/responses are JSON; private data is `Cache-Control: private, no-store`. Never cache API responses in a service worker. A successful mutation is committed before returning. No endpoint processes money.

## Transport and identity

POST/PATCH/DELETE requests require `Content-Type: application/json` and an exact configured `Origin`. Supply `{}` for bodyless actions, including subscription DELETE. Foreign/cross-site mutations are rejected. Default body limit is 8 KiB; only PATCH floor-layout saves allow 256 KiB, with a maximum of 500 spaces and 100 features. Unknown fields, invalid UUIDs/types/ranges and malformed JSON fail.

Same-origin browsers use the HttpOnly `parkly_auth` cookie automatically. It is SameSite=Strict, expires after 24 hours and is Secure on HTTPS. No token is returned in a JSON body. Session tokens are hashed in PostgreSQL. The remote bridge uses a separate server-only backend key; end users must not supply or receive it.

API input windows are UTC epoch milliseconds. Whole-hour arrival/departure must be future, within 90 days, and 1–24 hours apart. Display them using Asia/Almaty; do not parse a browser datetime-local value as an unspecified device timezone. Output `start`/`end` are epoch milliseconds; other timestamps are ISO UTC. Currency is KZT, rates/totals are integers. Public map availability is allocated reservation inventory only, never physical occupancy.

Errors have this shape:

```json
{"error":{"code":"SPACE_UNAVAILABLE","message":"This space overlaps a reservation, hold or maintenance block."},"requestId":"server-request-uuid"}
```

Common statuses: 400 invalid input; 401 missing/revoked session; 403 forbidden organization/admin/origin; 404 absent or invisible record; 409 allocation/price/status/version/idempotency conflict; 410 expired hold; 413 oversized body; 415 JSON required; 429 durable rate limit; 503 unavailable backend. SQL text, credentials and stack traces are not returned. Retry a transient `RETRY_REQUEST` using the same request key.

## Authentication

| Method/path | JSON body / result |
|---|---|
| POST `/auth/signup` | Disabled by default: 403 `REGISTRATION_DISABLED`. Only isolated automated-test instances explicitly enable historical signup; local users sign in with pre-provisioned fictional accounts. |
| POST `/auth/login` | `{email,password}`; generic invalid-credential response; rotates existing browser session; 200 `{ok,userId}` |
| POST `/auth/logout` | `{}`; revokes session and clears cookie; `{ok:true}` |
| GET `/auth/me` | `{user:null}` or own profile with highest role and roles array |

No email verification, recovery, password-change or MFA endpoints are implemented. Do not claim verified email ownership. Login/email/IP and mutation limits persist in the database; IP behind a shared bridge is conservative, not a production bot defense.

## Search, maps and backend quotes

| Method/path | Contract |
|---|---|
| GET `/facilities?q=&type=All&maxPrice=400&limit=50&offset=0` | Approved authorized facility projection, `{facilities,total,currency,physicalOccupancy}`; type All/Covered/Outdoor; price optional; limit 1–100 |
| GET `/facilities/:id/spaces?start=ms&end=ms` | `{spaces,source,physicalOccupancy}`; concrete bay IDs/labels/floor/coordinates, available boolean and allocation status |
| GET `/facilities/:id/layout?start=ms&end=ms` | `{facility,floors,quote,serverNow,physicalOccupancy}`; floors contain dimensions/features/published version and spaces. Quote is `{hourly,total,currency,start,end}` calculated by backend for exact requested interval |

Spaces include `x,y,width,height,rotation,reservable` and `availability_status`: available, unavailable, held. Unpublished draft spaces are hidden from public callers. No other user's identity or hold deadline is exposed. Floor geometry is published server data, not a static image. The driver UI requests fresh availability before holding, then the database rechecks under a space lock/exclusion constraint.

## Holds, reservations and sessions

| Method/path | JSON body / result |
|---|---|
| POST `/holds` | `{spaceId,start,end,quotedPrice,idempotencyKey}`; key UUID scoped to driver; `{id,state,expiresAt,total,serverNow}` |
| GET `/holds` | Own active `{holds}` with space/facility IDs, interval, deadline and agreed total |
| POST `/holds/:id/confirm` | `{}`; atomically converts same allocation; `{id,reference,total,status}`; same hold confirmation returns same reservation |
| POST `/holds/:id/cancel` | `{}`; own release, harmless retry; `{ok:true}` |
| GET `/reservations` | Latest 200 authorized `{reservations}`; RLS-scoped owner/member/admin |
| GET `/reservations/:id` | `{reservation,history,extensions}`; invisible booking returns 404 |
| POST `/reservations/:id/cancel` | `{idempotencyKey}`; owner before start or assigned staff; no active-session cancellation; terminal record retained |
| POST `/reservations/:id/extend` | `{end,idempotencyKey}`; original rate, whole hours, max 24h total; atomic additional cost/claim; conflict rolls back all changes |
| POST `/reservations/:id/check-in` | `{}`; assigned staff only, within reservation interval; unique session |
| POST `/reservations/:id/check-out` | `{}`; assigned staff only; ends session, completes reservation and releases allocation; repeat safe |
| GET `/sessions` | Latest 200 authorized `{sessions}`; source operator_recorded, not independently verified occupancy |
| GET `/reports` | All authorized records aggregated in SQL; counts, completed demo GMV, estimated 10% commission and 90% operator allocation; not collected revenue |

Holds last five minutes. A driver has at most three active holds; per-driver locks serialize the limit. Persist the same UUID while retrying the same intent; a new payload with an old key returns 409. The UI restores own matching holds after reopening the facility/interval. Countdown uses the server deadline/time with monotonic client elapsed time; server validation always decides expiry. Expiration creates durable history and releases inventory. Confirmed past-end reservations without an active parking session expire; active sessions require operator handling.

## Operator and floor editor

All routes require organization membership or admin permission; resource IDs never confer access.

| Method/path | Body / result |
|---|---|
| GET `/operator/organizations` | Own authorized `{operators}` |
| POST `/operator/facilities` | `{operatorId,name,area,address,lat,lng,type,price,capacity}`; pending fictional facility ID; capacity 0–500 |
| GET `/operator/facilities/:id/structure` | `{floors,spaces,blocks}` with active maintenance intervals |
| PATCH `/operator/facilities/:id/inventory` | `{capacity,price}`; activates/deactivates concrete bays safely, versions price; existing agreements preserved |
| POST `/operator/facilities/:id/floors` | `{name}`; creates floor ID |
| POST `/operator/facilities/:id/spaces` | `{floorId,label}`; legacy operator inventory addition with generated geometry |
| GET `/operator/floors/:id/layout` | `{floor,version,publishedVersion,hasDraft,document}`; draft merged with new real inventory IDs |
| PATCH `/operator/floors/:id/layout` | `{version,document}`; compare-and-save draft; returns new version; does not change public map |
| POST `/operator/floors/:id/spaces` | `{label}`; new unpublished, non-reservable space; increments draft version; editor must reload/reconcile |
| POST `/operator/floors/:id/publish` | `{version}`; atomic geometry/labels/reservability publication; stale version 409; new spaces become visible |
| POST `/operator/spaces/:id/blocks` | `{start,end,reason}`; maintenance interval shares booking exclusion constraint |
| POST `/operator/blocks/:id/cancel` | `{}`; releases maintenance allocation |

Layout document:

```json
{"width":800,"height":700,"spaces":[{"id":"existing-space-uuid","label":"A-12","x":60,"y":100,"width":90,"height":150,"rotation":0,"reservable":true}],"features":[{"id":"entry","kind":"entrance","label":"Entrance","x":30,"y":30,"width":120,"height":40}]}
```

Supply every floor space exactly once; unknown/foreign IDs and duplicate IDs/labels are rejected. Dimensions: floor width 400–10000, height 400–30000; bay width 36–240, height 48–300; rotation integer 0–359 degrees around its center. Rotated bays and features must fit inside the floor. Feature kinds: driveway, entrance, exit. Draft preview is local rendering of the saved/edited document; publication is a separate checked action. Disabling reservability prevents new holds but preserves existing bookings. Visual geometry is a planning model, not a safety-certified physical survey.

## Administration

| Method/path | Body / result |
|---|---|
| GET/POST `/admin/operators` | List organizations / create `{name}` |
| POST `/admin/operators/:id/members` | `{userId,enabled}`; creates or updates membership and grants operator capability |
| PATCH `/admin/facilities/:id/approval` | `{approved}` |
| PATCH `/admin/users/:id/active` | `{active}`; disabling revokes sessions; self-disable prohibited |
| PATCH `/admin/users/:id/roles` | `{role,enabled}`; driver/operator/admin; self-admin removal/last-admin loss protected |
| GET `/admin/audit` | Latest 200 `{audit}`; operational metadata only |

## Notifications and compatibility

GET/PATCH `/notifications/preferences`: own `{inApp,push}` updates (GET returns snake_case database fields under preferences). GET `/notifications` returns latest 100 own event rows. POST `/notifications/:id/read` takes `{}`. POST `/push-subscriptions` takes `{endpoint,p256dh,auth}`; HTTPS browser endpoint only, own storage. DELETE `/push-subscriptions/:id` takes `{}`. The standards-based reminder extension supersedes this legacy subscription description: encrypted devices, explicit opt-in, a durable worker, retries and protected push events are implemented. See NOTIFICATIONS_DEPLOYMENT.md for the current contracts and deployment requirements.

GET `/compat/state` and POST `/compat/action` preserve the existing website DTO/actions while using PostgreSQL. `/api/demo` forwards to these; `/api/availability` forwards to concrete space availability. Profile/favorites/legacy inventory/approval actions remain checked server writes. Shared demo login and arbitrary completion are rejected in PG mode; use password/session APIs and staff check-in/out. A configured PostgreSQL failure never falls back to D1 or client storage.

## Workspace completion (30 October 2026)

See `WORKFLOW_COMPLETION.md` for the current behavior and verification limits.
All routes below require authentication; admin paths additionally require the admin
role. Server Origin checks apply to mutations. Bodies reject unknown fields.

| Route | Input / response |
|---|---|
| GET `/dashboard` | All-date own/managed/admin aggregates, serverNow; no client list truncation |
| GET `/reservations` | `limit=1..200`, `offset=0..100000`, `scope=authorized|own|managed`, `bucket=all|current|upcoming|active|past`, `q` max160; returns reservations,total,limit,offset,serverNow |
| GET `/reports` | optional paired UTC-millisecond `start,end`; optional facility UUID; stored completed values by reservation creation interval; no actual payment/cost ledger |
| GET `/operator-applications` | limit1..100/offset, own or admin RLS; pending first; applications,total |
| POST `/operator-applications` | name2..100, description10..2000, idempotencyKey UUID |
| PATCH `/admin/operator-applications/:id` | approved boolean,note3..2000; one atomic organization/membership/role grant on approval |
| GET `/support` | limit1..100/offset; tickets,total scoped to own/admin |
| POST `/support` | subject3..120,message3..4000,idempotencyKey; optional own reservationId |
| GET `/support/:id` | protected ticket and up to500 messages |
| POST `/support/:id/messages` | message3..4000,idempotencyKey; admin-only optional status open/in_progress/resolved |
| PATCH `/operator/facilities/:id/details` | name,area,address,rules,hours; assigned membership required |
| GET `/notifications` | own in-app notifications,total,limit1..100/offset; read endpoint unchanged |
| GET `/admin/users` | q,limit1..100/offset; users,total; no passwords/emails/session tokens |
| GET `/admin/audit` | q,limit1..200/offset; audit,total; no secret bodies |
| GET `/admin/system` | database availability, server time, worker heartbeat, failed push count, operator sessions past deadline |
| POST `/auth/password` | currentPassword,newPassword12..128; verifies current password, hashes replacement, revokes all sessions/device bindings and clears cookie |

List predicates are parameterized, queries run in user-scoped transactions, and
application/support writes go through checked SQL functions. Password hash values
are never returned by HTTP responses. Driver registration never accepts a role.
