# Historical D1 phase — superseded for PostgreSQL mode

Kept for existing D1 users and audit evidence. Use the current README and ARCHITECTURE for the PostgreSQL application.

# Verification record

Date: 28 October 2026. All mutation tests use fictional records in a new disposable local D1 database. No hosted API/database was used for mutation testing. The normal `.wrangler/state` was not migrated. The separate mobile source and servers were preserved.

## Completed automated checks

| Check | Result | Evidence / limits |
|---|---|---|
| `pnpm test` | 14 tests pass | 6 booking/SQL/auth/validation tests, 4 finance tests, 2 search/filter tests, 2 manifest/worker tests |
| `pnpm typecheck` | Pass | Website strict TypeScript, excluding the pre-existing separate mobile project |
| `pnpm build` | Pass | Existing Vinext/Vite/Cloudflare build; no dependency changes needed |
| `git diff --check` | Pass | No whitespace errors; mobile changes remain uncommitted and preserved |
| Initial plus two new migrations | Pass on fresh local D1 | Original 0000 unchanged; 0001 structures and 0002 guards applied in order to disposable storage |
| Legacy migration compatibility | Pass in SQLite test | Existing booking row retained with null legacy hourly-price snapshot; future invalid writes/terminal reversal rejected |
| `PARKLY_TEST_URL=http://127.0.0.1:5180 pnpm test:integration` | Pass | Real local Worker/D1 HTTP service, including concurrency and authorization |
| Audit reconciliation | Pass | Six test/browser-created bookings had six creation audit rows; zero missing creation audits at that checkpoint |
| PWA HTTP assets | See final status below | A 200 status alone is insufficient; the smoke test checks actual body, MIME and worker cache policy |

The API suite proves: eight final-slot requests yield one accepted reservation; eight identical request-key retries yield one reference; back-to-back intervals preserve remaining long-window capacity; cancellation/retry and terminal conflicts behave correctly; inventory floors and ownership are enforced; pending listings cannot be booked; agreed totals survive rate edits; malformed JSON/media/origin/missing flags fail; missing admin targets return 404; favorites persist; private API responses are no-store.

The worker-policy unit test evaluates the actual `public/sw.js` script with controlled network/cache objects. It verifies that API/auth/RSC/mutation/cross-origin requests are bypassed, navigation uses network then a public fallback, and unrelated files are not cached. This is not a real Safari offline/install test.

## Browser walkthrough

Full-stack website on loopback 5180, using the same disposable D1:

1. Opened existing branded home and demo account dialog.
2. Selected Driver; dashboard and hash location loaded.
3. Opened map/list and Baiterek Business Parking details. Selected-time inventory returned eight fictional slots.
4. Reviewed two hours at 300 KZT/hour, total 600 KZT; confirmed through the UI.
5. Observed a new full booking reference and one upcoming booking in the driver dashboard.
6. Reloaded; the hash location, signed-in demo account, reference, time and total persisted.
7. Canceled through the UI; upcoming count returned to zero and the same reference remained in Past history with status `cancelled`.

The narrow in-app-browser panel had unreliable pointer targeting for some offscreen controls; labelled keyboard activation completed review/confirmation/cancellation. This is not a substitute for touch-device QA. DOM geometry checks at 375px, 768px and 1440px reported document width equal to viewport width, with no horizontal page overflow on the map view. Final trimmed-search/reset and mobile navigation were exercised. Five approved locations reappeared after reset. The final preview screenshot is saved at `outputs/pwa-audit-preview.jpg`; additional temporary viewport evidence is under the same ignored outputs directory. The final build exposed no captured browser console errors in this walkthrough. These checks do not certify every page at every viewport.

## PWA static-serving repair

The final runtime inspection found that the Worker could return an empty response carrying `x-vinext-static-file` for a public PWA file. The generated configuration did not include the `ASSETS` binding required by Vinext to resolve that signal. `vite.config.ts` now explicitly declares the binding. Restarting Wrangler after the config change produced a nonempty 781-byte manifest.

The read-only HTTP check initially encountered an approval denial with no reason. The user explicitly approved the saved `tests/pwa.integration.mjs` check. It then detected that default static cache headers differed from the intended worker policy. `public/_headers` now declares the service-worker MIME/no-cache policy and manifest MIME. These headers apply even when the static-assets service handles a file without invoking the Worker.

Final PWA HTTP smoke-test status: **PASS** after rebuilding and restarting Wrangler. Manifest: 781 bytes; service worker: 1,368 bytes; offline page: 879 bytes; 192px PNG: 1,923 bytes; existing business report: 40,114 bytes. All five returned HTTP 200 with the expected MIME type; the service worker passed its no-cache/no-store assertion. The original immutable cache policy for hashed framework assets is retained. Wrangler must be restarted after a built asset/config change; its in-place reload briefly retained stale asset metadata during verification. Installation on a real device is still not implied.

## Reproduce safely

Follow the fresh scratch-database commands in `README.md`. The API test requires an explicit loopback `PARKLY_TEST_URL`; it refuses remote URLs. The PWA HTTP smoke test is read-only and also restricted to loopback. For example:

```bash
pnpm test
pnpm typecheck
pnpm build
PARKLY_TEST_URL=http://127.0.0.1:5180 pnpm test:integration
PARKLY_TEST_URL=http://127.0.0.1:5180 pnpm test:pwa
```

Do not run mutation tests on ordinary working data. They intentionally leave canceled booking history and audit records. Do not replay migrations on an existing database whose migration state is unknown. Normal and hosted databases require backup/schema preflight before applying pending changes. The test server is stopped at teardown; use the README command to restart a preview.

## Explicit verification limits

- Separate SRS document and parking-map reference image were not supplied; no visual comparison or full SRS compliance claim.
- Hosted Sites identity configuration and trusted-header ingress not activated or end-to-end tested. Local demo identity is shared, not real verification.
- No real iPhone/Android Add to Home Screen, Safari install/update, push, offline browser switch-account, or native app test.
- A read-only connection to the pre-existing `.wrangler/state` SQLite file could not be opened, even outside the sandbox. Its direct record-level preflight remains incomplete; schema source and a fresh real D1 instance were inspected/tested instead. It was not migrated or reset.
- No benchmark, production load/failover test, automated screen-reader/contrast audit, penetration test, dependency-advisory scan or hosted backup/restore drill.
- Parking sessions, extensions, push, partner onboarding, server report ledger and real payment integration remain planned, not tested features.
- Build emits Vinext's existing “route classification unknown” notice for `/`; it completed successfully. No claim of standard Next-server parity.
- Changes remain local and uncommitted. No production deployment, hosted migration, secrets commit or source upload.
