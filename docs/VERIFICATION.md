# Latest reminder verification — 28 October 2026

This section supersedes earlier push/session limitations in the historical floor-map record below.

- Root tests: 17 passed. Backend tests with `PARKLY_PUSH_NETWORK_TEST=1`: 34 passed, including five service-worker tests.
- Native PostgreSQL reminder tests proved concurrent dispatch, durable retry identity, expired-lease recovery, preferences, encrypted subscription ownership, logout cleanup, extension collision/quote/version changes and a four-second expiration fixture without an open browser.
- An actual encrypted Web Push worker request to a deliberately invalid synthetic FCM endpoint returned HTTP 410; its failed attempt and device cleanup were recorded. No device delivery was claimed.
- Browser QA verified worker heartbeat, preference persistence/reversion, the session card, a 400 KZT extension to 1,200 KZT and refreshed protected booking link. No notification permission was requested by the agent.
- A private cold backup was taken before local migrations 009–012; original data and legacy D1 were preserved. Local VAPID/encryption keys have mode 0600 and are ignored.
- Full details, service-role provisioning, browser conditions and production limits: [notification deployment](NOTIFICATIONS_DEPLOYMENT.md).

## Earlier floor-map checkpoint

# Verification record

Date: 28 October 2026. Branch `feature/mobile-app`. No production deployment, hosted migration, source upload or commit. Existing website/mobile source and original D1 data were preserved. PostgreSQL mutation tests used isolated temporary databases; browser QA used the persistent local fictional PostgreSQL database under ignored `backend/.local/`.

## Final automated checks

| Check | Actual result | Scope |
|---|---|---|
| Root `pnpm test` | 17 passed | Existing booking/SQL/auth/finance/search/PWA regressions plus floor zoom, rotated bounds and state-color tests |
| `pnpm backend:test` | 17 passed, 0 failed | Node test entries including the parent scenario; real native PostgreSQL, eight migrations, restricted runtime role, actual HTTP/SQL operations |
| Website `pnpm typecheck` | Passed | Existing app and new floor/editor/account components |
| `pnpm backend:typecheck` | Passed | API, scripts and database tests |
| `PARKLY_BACKEND_URL=http://127.0.0.1:5191 pnpm build` | Passed | Existing Vinext/Vite/Worker build, resource API bridge included |
| `pnpm dev:fullstack` | Started successfully | Persistent PostgreSQL/API then existing Vite website at 127.0.0.1:5173; data retained across restart |
| PWA HTTP smoke check on final built website | 5 passed | Nonempty manifest, service worker, offline page, icon and business report; MIME/cache policy checks |
| `git diff --check` | Passed | Source whitespace; no commit created |
| Private-state ignore checks | Passed | backend/.local credentials, database/dependencies and outputs excluded from Git |

Root Node tests report 17 entries, and backend Node tests report 17 entries. These are not 34 independent user journeys; the backend includes a parent scenario and its subtests. No production benchmark or device certification is implied.

## Required database and API cases

| Requested case | Evidence |
|---|---|
| Two users book the same space simultaneously | Two independent cookies race a hold on one space: exactly one 200 and one 409; winning hold confirms one reservation. GiST exclusion also rejects a privileged overlapping direct INSERT |
| User accesses another user's reservation | Other user receives 404 for read/cancel; direct restricted SQL under outsider identity returns zero reservation/profile rows; direct reservation UPDATE has no grant |
| Operator edits another organization | Foreign operator and driver get 403; assigned operator succeeds; membership reads scoped |
| Expiration | Forced expired hold returns 410 and commits release/history; next user can hold it. Ended confirmed booking transitions to expired with history |
| Cancellation | Own cancellation and repeated request are safe; cancelled history remains; browser availability/booking state refreshes |
| Extension conflicts | Extension into another reservation returns 409; original end/total and extension list unchanged. After blocker cancellation, same-key extension increases total once |
| Non-overlapping intervals | Adjacent bookings on the same space both succeed; a previous end is not treated as an overlap |

Additional coverage: random password salts and verification; driver-only signup/role injection rejection; invalid credentials, logout/disabled sessions; HTTP 400/403/413/415 and unsafe database-owner startup rejection; durable six-request hold retry; maintenance/booking exclusion and safe inventory shrink; scoped check-in/out and notifications; admin organization/membership/facility/floor/space approval; RLS tenant checks; authorized all-record report; optimistic floor draft conflicts, unpublished inventory rejection, geometry/label validation and publication; a 500-space saved layout larger than the ordinary 8 KiB request cap.

The first floor-draft test exposed an ambiguous PL/pgSQL JSON alias. It was repaired in append-only migration 008, preserving 007. The full suite then passed from a fresh database with all eight files. The test also proved the existing 500-space capacity can be represented within the extended coordinate bounds.

## Browser end-to-end evidence

Password authentication was tested through the same-origin website bridge using generated synthetic accounts; credentials were not printed or included in screenshots.

1. The existing home/map opened from the unchanged website navigation.
2. A driver selected Botanical Garden Garage / Ground S-0002, held two hours for 800 KZT, confirmed, extended to three hours/1,200 KZT, and reloaded successfully.
3. The API and PostgreSQL were stopped/restarted; the same profile/session/reference/extended agreement remained. The booking was cancelled through the UI and remained in Past history. Reference: `PK-6A8CFBF4-2CAC-4AD0-AEAD-8CFFAB29F3CA`.
4. The local operator signed in through real authentication, created Floor 2 and Floor 3, added A-12/A-13/A-14/B-14, moved/rotated A-12, enabled reservable inventory, saved drafts, previewed and published. A-13 was published unavailable. The rotation-test bay was later returned to aligned coordinates through the authorized operator API; other records were preserved.
5. The driver opened the new floor map, switched among Floor 2/Floor 3/Ground, selected A-14, used zoom/fit, created a five-minute backend hold, saw the server countdown and confirmed 800 KZT through Book Now.
6. Reference `PK-D198546F-55A9-46E3-84AC-DE74F9D37C7F` / A-14 survived a full page reload and logout/login. Cancellation was then saved in Past history. Other existing reservations were preserved.
7. Mouse dragging changed the SVG transform to a nonzero pan; Fit restored it. Geometry checks at 375px and 1440px showed viewport, document and floor-screen widths equal, with no page overflow. The temporary viewport override was reset.
8. The final built Worker, not only the dev server, loaded the same persistent facilities/floors and backend quote. PWA files passed the read-only HTTP checks after the built preview was restarted.

Screenshots in ignored `outputs/`: `parkly-floor-map.jpg`, `parkly-floor-map-desktop.jpg`, `floor-map-hold.jpg`, `postgres-booking-extended.jpg`, `postgres-booking-cancelled.jpg`. Some screenshots show different scroll positions and the normal narrow in-app browser viewport. They are evidence from the running application, not static design mockups.

## PWA and known runtime limits

The final HTTP check returned: manifest 781 bytes, worker 1,368 bytes, offline page 879 bytes, 192px icon 1,923 bytes and business report 40,114 bytes. All had expected MIME types, and worker cache policy passed. Public API/account responses remain no-store and outside the service-worker cache allowlist. This does not prove Safari installation or offline device behavior.

Vinext remains a beta runtime. The build emits its existing route-classification notice. Dev HMR emitted a multiple-renderers warning during source changes; the built preview was used for final checks. An early development shutdown exposed a double-stop warning; API/local-launcher close guards were added. No data reset resulted. Production framework staging/monitoring is still required.

## Not claimed or completed

- No production deployment, external managed database acceptance, D1-to-PostgreSQL data import, backup/PITR restore drill or load/failover/penetration test.
- No separate supplied SRS reconciliation. The later smartphone floor-map screenshot was inspected and used for layout inspiration.
- No physical iPhone/Android pinch/drag, VoiceOver/screen-reader, push delivery, Add to Home Screen or Safari update certification. Pointer pinch is implemented; the tool-based gesture checks verified mouse pan/button zoom and math, not real multitouch hardware.
- No real parking partners, independently verified physical occupancy, barrier/sensor feed, real payments/refunds or collected revenue.
- No email verification, password recovery, privileged MFA, complete Russian translation, production retention/legal/data-location approval or deployment CI.
- Native Expo mobile source remains intact and separate; the new floor UI is in the website/PWA. The previous mobile export at port 8082 is not this PostgreSQL website.

Use `README.md`, `backend/README.md` and `API.md` to reproduce. Temporary preview servers are stopped after QA; `pnpm dev:fullstack` restarts the application and retains PostgreSQL data. Historical D1 verification is preserved separately in `LEGACY_D1_VERIFICATION.md`.

## 30 October workflow completion

Superseding verification: `WORKFLOW_COMPLETION.md`. Production build, two TypeScript
projects, strict application lint, 17 website unit tests, 41 backend/service-worker
tests, a 21-step website/API/PostgreSQL workflow and public/PWA smoke checks passed.
The new isolated tests include 205-record reporting, concurrent approval, private
support and password-session revocation. Browser-tab automation was unavailable;
no new visual, browser-click E2E or real-device push success is claimed.

## Reservation time editing fix — 14 November 2026

The floor-booking datetime controls previously updated React state only after awaiting hold release, allowing native controlled inputs to revert. Moving arrival also left departure on the old date and discarded the entire floor layout when the interval became invalid. The screen ran a one-second render timer even without a hold.

The corrected form updates both times synchronously, preserves the reservation duration when arrival moves, and keeps departure independently editable. Availability requests are debounced, aborted on a newer edit/unmount and bounded by a ten-second deadline; only the latest matching quote enables reservation. The previous plan stays visible while the selected interval is being checked or corrected. The countdown runs only for an active hold.

Executed browser checks used the native datetime controls (keyboard day/hour changes), including rapid repeated changes and an invalid departure before arrival followed by correction. Arrival/departure remained editable, validation recovered and the server quote updated. A fictional driver released a hold, changed the interval again and confirmed Floor 2/A-12 for 15 November 2026, 17:00–19:00, 800 KZT. The confirmation and history showed those exact persisted times. That new QA reservation was then cancelled; no existing user reservation was changed. Screenshot: ignored `outputs/course-qa/time-change-confirmed.png`.

Root tests now include four calendar/window regressions (21 total passed), covering duration preservation, midnight/year rollover, independent departure changes, incomplete native input and recovery from invalid windows. TypeScript, lint and both production build targets were checked. No database migration or website deployment is part of this fix.
