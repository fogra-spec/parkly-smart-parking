# Parking reminders, sessions and deployment

Implemented locally on 28 October 2026. The existing Parkly website/PWA, navigation, PostgreSQL booking engine and native mobile source are preserved. No production deployment or production secret configuration was performed.

## What runs

`backend/src/reminder-worker.ts` is a server worker that polls durable PostgreSQL jobs every five seconds. Booking confirmation creates four UTC jobs in the same transaction. Extensions create a new reminder version, cancel the old pending work and schedule against the new end. Cancellation/completion cancels unsent work. A browser tab is not involved in scheduling.

| Time | Message |
|---|---|
| 30 minutes before the end | Your parking ends in 30 minutes. |
| 15 minutes before the end | Your parking ends soon. Extend if available. |
| 5 minutes before the end | Only 5 minutes remain. |
| At reservation expiration | Your parking reservation has ended. |

Preferences independently control these checkpoints, in-app history and push. Changes affect future unsent reminders; already missed checkpoints are not replayed. A reservation created after a checkpoint does not trigger a burst of old warnings. Before-end messages have a two-minute validity window; expiration messages have ten minutes. Outage recovery skips stale warnings rather than showing misleading old text.

The session card shows location, floor, bay, reference, start/end in Asia/Almaty, server-synchronized countdown and state. It distinguishes a timed reservation from an operator-recorded parking session. Expiration is not proof of physical vehicle departure. An operator session can remain open after the reservation deadline until staff record checkout.

## Local use

```bash
cd "/Users/dmp/Documents/codex tg/parkly/site"
cd backend
pnpm install --frozen-lockfile --ignore-scripts
cd ..
pnpm dev:fullstack
```

The local launcher applies append-only migrations, generates private keys once and starts the PostgreSQL API plus reminder worker. The website stays at http://127.0.0.1:5173. All keys/data are in ignored `backend/.local/`; the key file is mode 0600. The local VAPID contact uses a reserved example address for development, not a verified support mailbox. Set a real monitored contact for production.

My bookings → Parking reminders:

1. Set the reminder preferences.
2. Click Enable reminders on this device. Only this click requests notification permission. Reconnect replaces a stale native subscription and its account binding.
3. Choose a device name. A successful subscription is not a claim that a message was delivered.
4. With an own active/upcoming reservation selected, click Queue test reminder. This creates a real server job with clearly labelled test text. It does not change the booking deadline.
5. Refresh status to inspect attempts. `accepted` means the push service accepted an encrypted request. `display_requested_at` means the service worker's showNotification call resolved. Neither proves that a person read or saw a banner.
6. Unsubscribe to revoke that device and clear its stored capability. Other devices remain subscribed. Logout also clears the current browser binding/native subscription and revokes session-bound registrations.

No frontend alert is used to imitate a push. In-app history is ordinary persistent history, not a substitute for a system notification.

## Browser and installation requirements

Use HTTPS on the actual public origin. Loopback is a desktop development exception; 127.0.0.1 on an iPhone refers to the phone, and plain LAN HTTP is not a secure PWA deployment.

Compatible desktop and Android browsers use Service Worker, PushManager and Notification APIs. Unsupported APIs, insecure contexts and denied permission have explicit UI messages. The app never repeatedly asks on page load. If blocked, users must change browser/system settings themselves. Private-browsing storage or subscription restrictions may prevent enabling push.

On iOS/iPadOS 16.4 or later, add Parkly to the Home Screen, open the installed PWA and then press Enable. A normal iOS browser tab is not the supported installation path. The manifest, standalone display, stable app ID and branded icons remain configured. Permission, Focus mode, notification summaries, connectivity and OS policies can delay or suppress presentation. Real iPhone/Android installation and device delivery still need acceptance testing.

## Security and privacy

- `app.push_devices` stores AES-256-GCM encrypted subscription JSON, bound to the user UUID with authenticated additional data. Endpoints are indexed with keyed hashes. Plain endpoints, auth secrets and VAPID private keys are not returned in account APIs or send logs.
- The API role has RLS for own device/history records and checked registration/revocation functions. A separate non-owner, NOBYPASSRLS worker login executes only the queue functions. It cannot query account passwords or directly update bookings.
- Devices are bound to an authenticated session for logout/disable revocation. Opt-in can outlive the 24-hour login cookie; generic push display uses a short-lived signed capability. Viewing a booking still requires a normal authenticated owner session. No location, name, email or booking price is in the push payload.
- A service worker device binding rejects another account/device's queued messages. It checks the live server job before showing a reminder, so changed/cancelled/expired/opted-out reminders are suppressed, including messages previously accepted by a push service.
- Capability tokens travel in encrypted Web Push payloads and same-origin HTTP headers, not URLs. Notification clicks open only `/#/driver?booking=<uuid>` on Parkly's origin. The destination enforces own-user authorization.
- Outbound endpoints are restricted to supported vendor hosts over HTTPS. DNS results are pinned to public IP addresses; private/loopback/metadata addresses and redirects are not followed. Requests have an overall timeout. Provider response bodies and subscription URLs are not stored in failure logs.
- HTTP 404/410 disables the registration, clears its ciphertext and stops future attempts. Explicit unsubscribe/logout does the same. Non-sensitive IDs/history remain for investigation. Define retention periods before production; this is not an unlimited-retention policy approval.
- The older unconfigured plaintext subscription table is retained read-only for preservation and is not used by the sender. Existing legacy clients must explicitly enable a new encrypted subscription. Review/migrate any legacy personal data before a public launch.

## Retry and duplicate semantics

The database has a unique reservation/version/checkpoint job and a unique job/device delivery. Workers use SKIP LOCKED claims and 90-second leases. Attempts are recorded before network work. Transient network/429/5xx failures retry with bounded backoff, up to five attempts while the reminder remains valid. Known permanent failures are retained in the attempt log. An abandoned lease is recovered, with the previous attempt marked unknown rather than falsely successful.

A push HTTP response can be lost after a service accepted a message. Exactly-once network delivery cannot be promised. Retries use the same delivery ID, signed capability and collapse topic. The service worker atomically claims delivery IDs in IndexedDB and uses a per-booking notification tag to prevent visible duplicates. It stores only IDs/timestamps and a device binding, not business records or capability tokens. A rare crash between claiming an ID and requesting a browser display can lose a notification; IndexedDB deduplication is not an OS delivery guarantee. Display acknowledgements are not human-read receipts.

Already visible system notifications cannot be recalled globally. An extension performed in the app closes its current device's old booking notification; later clicks always open the current server state. Server/device clocks should be synchronized with NTP.

## Production provisioning — instructions only

Use approved hosting with an always-running API, independent worker service and managed PostgreSQL. A sleeping laptop is not a production scheduler. The Worker website remains an HTTP bridge; no PostgreSQL TCP connection or private push key is embedded in the browser bundle.

1. Back up the database and rehearse restore. Apply `backend/migrations/009`–`011` through the existing migration runner/owner, after the earlier files. They add jobs/devices/attempts, state-change hooks, protected event views and checked extension quotes. Existing booking records are retained. A private cold backup of local data was taken before this upgrade; no production restore/PITR is claimed.
2. Provision the runtime API login with only `parkly_app`, as described in the backend README. Provision a separate worker login:

```sql
CREATE ROLE parkly_notify LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
  PASSWORD '<injected-strong-secret>';
GRANT CONNECT ON DATABASE parkly TO parkly_notify;
GRANT parkly_notifications TO parkly_notify;
```

Do not give either login ownership, superuser privileges or owner-role membership. Remote database URLs must use `sslmode=verify-full` with trusted certificates.

3. Generate VAPID and a 32-byte encryption key in a trusted environment. `pnpm push:keys` writes local development keys privately without printing them; production keys belong in a secret manager, outside the repository and source archives. Keep keys stable across restarts. Back up the encryption key separately and securely; losing it prevents decrypting subscriptions. Plan key rotation and re-subscription explicitly.
4. API environment (private runtime secret file):

```text
DATABASE_URL=<restricted-api-url-with-verified-TLS>
PARKLY_PUBLIC_ORIGIN=https://<approved-parkly-origin>
PARKLY_API_HOST=0.0.0.0
PARKLY_API_PORT=5191
PARKLY_BACKEND_KEY=<same-strong-secret-as-website-bridge>
PARKLY_VAPID_PUBLIC_KEY=<public-key>
PARKLY_PUSH_ENCRYPTION_KEY=<base64url-32-byte-secret>
```

The API does not need the VAPID private key. Worker environment:

```text
PARKLY_NOTIFICATION_DATABASE_URL=<restricted-worker-url-with-verified-TLS>
PARKLY_VAPID_PUBLIC_KEY=<same-public-key>
PARKLY_VAPID_PRIVATE_KEY=<private-key-worker-only>
PARKLY_VAPID_SUBJECT=mailto:<real-monitored-contact>
PARKLY_PUSH_ENCRYPTION_KEY=<same-encryption-secret-as-api>
```

5. From the backend package, under a supervisor, start the services separately:

```bash
node --env-file=/run/secrets/parkly-api.env --experimental-strip-types src/server.ts
node --env-file=/run/secrets/parkly-worker.env --experimental-strip-types src/reminder-worker.ts
```

A Linux systemd worker template is in `backend/deploy/parkly-reminders.service`. Adapt paths, user and secret-manager integration on staging before enabling it. No service was installed by this task. Permit outbound TCP 443 and DNS to the supported push vendors, plus the restricted PostgreSQL connection. Restrict API ingress to the website bridge/monitoring. Configure the approved HTTPS backend URL and shared key in the existing Worker runtime, never as public Vite variables.
6. Monitor `SELECT app.notification_worker_status()` with the restricted worker login; alert if heartbeat is older than 30 seconds. Monitor cycle failures, 429/5xx rates, permanent failures and missed deadlines. Rehearse worker restart/lease recovery and backup/restore before release.
7. Test a real browser subscription and native display on staging, including Android and an installed iOS PWA, denied permission, logout, expired endpoint, extension, click-through and API outage. Get deployment approval before production rollout.

## APIs added or extended

- GET `/push/config`, GET `/push/devices`, POST `/push/current` (endpoint in JSON, never a query string).
- POST `/push-subscriptions` with `{endpoint,p256dh,auth,label}`; DELETE `/push-subscriptions/:id` with `{}`.
- GET/PATCH `/notifications/preferences`; optional PATCH keys `remind30`, `remind15`, `remind5`, `remindEnd` alongside `inApp` and `push`.
- GET `/notifications/reminders`, GET `/notifications/delivery-history` (own rows only).
- POST `/notifications/test` with `{bookingId,deviceId,idempotencyKey}`; own confirmed booking/device, at most one new test per minute.
- GET `/push/events/:deliveryId` and POST `.../display`: signed device capability headers only, generic text, short validity. No booking details are disclosed through this path.
- GET `/parking-session?booking=<optional-own-id>`; GET `/reservations/:id/extension-options`.
- POST `/reservations/:id/extend` accepts `quotedTotal` from the server quote. Price checking, overlap exclusion, extension line item, history and new reminder version commit together. Legacy callers without that field remain compatible.

## Verified evidence and limits

`PARKLY_PUSH_NETWORK_TEST=1 pnpm backend:test` passed 34 Node test entries. Root tests passed 17. The reminder suite runs on a new native PostgreSQL cluster. A trusted fixture compresses a booking to four seconds and checkpoint times to subsecond intervals; the real worker timer creates attempts, records expiration and does not redispatch accepted jobs. Production booking policy remains whole-hour; there is no public time-travel/short-booking bypass.

Controlled transport tests verify concurrent claims, retry identities, lease recovery and 410 cleanup. A separate actual encrypted HTTPS Web Push attempt to a deliberately nonexistent FCM endpoint returned HTTP 410 through the same worker, with the failure logged. This was not delivery to a real device. Five service-worker tests use an IndexedDB implementation and mocked browser APIs to verify concurrent/retried deduplication, receipt loss, rejected display, stale/revoked payloads and protected click routing. They do not certify a physical OS notification.

Browser QA verified persisted/restored preferences, live worker heartbeat, the session countdown, a 400 KZT extension to 1,200 KZT total, refresh persistence and the exact protected booking link. No notification permission was granted by the agent and no successful device push is claimed. Existing iOS install/offline behavior still requires real-device acceptance.

Primary sources checked: [WebKit Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple cross-browser Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [web-push library](https://github.com/web-push-libs/web-push). These explain platform behavior; local test evidence describes this implementation.

Migration 012 also prevents open, overdue operator sessions from consuming the bounded expiry-cleanup batch. A real database test keeps an operator session active while an expired hold is released; no physical departure is inferred.
