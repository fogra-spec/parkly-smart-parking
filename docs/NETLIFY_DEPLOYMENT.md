# Parkly on Netlify

## Status

The repository now has an additional Netlify deployment target. It reuses the
existing React application, styling, hash routes, PWA, API business logic,
authentication, PostgreSQL migrations and RLS. The existing Vinext/Cloudflare
build and local public link remain available. This document is setup guidance;
it is not evidence that a cloud deployment or database migration has completed.

Local checks completed on 31 October 2026: both frontend build targets, website
and backend TypeScript checks, strict lint, 17 website unit tests, and 44 passing
backend test entries (one optional external push-transport test skipped). The
backend checks include the Netlify HTTP adapter with real temporary PostgreSQL,
secure cookies, foreign-origin rejection, racing holds, private-booking isolation,
idempotent confirmation/cancellation and the legacy API contracts. Both Netlify
Functions were packaged by the official CLI; archive inspection confirmed that
local keys, environment files and database runtime state are excluded. Cloud
deployment, cloud data migration and real-device push verification remain pending.

## Components

- `pnpm build:netlify`: Vite builds the existing client into `dist-netlify/`.
  `netlify/main.tsx` imports the same Parkly and PWA components used by Vinext.
- `netlify/functions/parkly-api.mts`: same-origin HTTPS API. It calls the shared
  `backend/src/http-handler.ts`, retaining password sessions, exact Origin checks,
  validation, database authorization, transactional holds and exclusion constraints.
  Legacy `/api/demo` and `/api/availability` routes keep their existing contracts;
  no local-storage or fixture-array fallback is provided.
- `netlify/functions/parking-reminders.mts`: platform-scheduled job every minute
  in UTC. It uses the existing durable PostgreSQL leases, versions, attempt logs,
  cancellation checks and worker. Delivery can start up to a minute after its due
  time, plus platform/network delays. This is not an exact-second guarantee.
  This deployment reports worker health with a 150-second heartbeat window,
  allowing the one-minute schedule; local continuous-worker thresholds are retained.
- Managed PostgreSQL must be provisioned independently of the Mac. Netlify
  Database is one option if its plan and database privileges support Parkly.
  Check `btree_gist`, NOLOGIN roles, restricted logins and SECURITY DEFINER functions
  before choosing the provider. A generic owner-only connection is insufficient.

## Deployment prerequisites

1. Link the exact existing Netlify project supplied by its owner with
   `netlify link --id <project-id>`. Do not create another project automatically.
2. Inspect the existing project's deploy/configuration before replacing it.
3. Provision a dedicated managed PostgreSQL database and verified TLS. Run the
   immutable migrations with a separate migration owner, following
   `backend/README.md`. Create restricted `parkly_api` and notification logins;
   grant only `parkly_app` and `parkly_notifications` respectively.
4. For data migration, take a private PostgreSQL backup, rehearse restoration and
   preserve IDs, password hashes, foreign keys and migration checksums. Exclude
   active browser sessions, device subscriptions and expired transient holds at
   cutover as appropriate. Changing origin requires signing in and opting into
   push again. Never run fixture seeding or the native local launcher on production.
5. Inject runtime secrets in Netlify's environment settings with Functions scope.
   `DATABASE_URL` must belong to the restricted API login and use verified TLS
   (`sslmode=verify-full`). Never use `NETLIFY_DB_URL`/owner credentials as an
   automatic API fallback. The API fails closed until configuration is valid.
6. Build and inspect a draft deploy. Smoke-test authentication, CSRF rejection,
   private records, concurrent holds, booking, cancellation, extension and PWA.
   Publish only the verified artifact to the selected project. Check scheduled
   jobs on production: Netlify does not automatically schedule draft deploys.

## Runtime environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Restricted API PostgreSQL URL, never an owner login |
| `PARKLY_PUBLIC_ORIGIN` | Exact canonical HTTPS origin without trailing slash |
| `PARKLY_NOTIFICATION_DATABASE_URL` | Separate restricted reminder-worker login |
| `PARKLY_VAPID_PUBLIC_KEY` | Public Web Push identity |
| `PARKLY_VAPID_PRIVATE_KEY` | Private Web Push signing key, server only |
| `PARKLY_VAPID_SUBJECT` | Valid production HTTPS/contact mailto URI |
| `PARKLY_PUSH_ENCRYPTION_KEY` | Existing/generated private 32-byte base64url key |

The native Netlify API is not an HTTP bridge, so it does not need
`PARKLY_BACKEND_URL` or the server-to-server bridge key. No database credentials or
private push keys are read by the frontend. Do not configure secrets with `VITE_`
or `NEXT_PUBLIC_` prefixes. Do not commit `.netlify/`, environment files, backups,
credentials or database runtime state. `dist-netlify/` is generated and ignored.
The runtime push configuration reads injected environment variables only. Local
key generation/loading is isolated in `backend/scripts/local-push-keys.ts` and is
not part of the Functions dependency graph. Configuration also excludes private
runtime directories; inspect the actual function archives before uploading.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm --dir backend install --frozen-lockfile --ignore-scripts
pnpm build:netlify
pnpm typecheck
pnpm backend:typecheck
pnpm lint
pnpm test
pnpm backend:test
netlify build
netlify functions:build --src netlify/functions --functions .netlify/parkly-functions
pnpm netlify:check-artifacts
netlify deploy --dir dist-netlify
# Inspect the draft and verify the cloud database before publishing:
netlify deploy --prod --dir dist-netlify
# Verify the actual canonical HTTPS origin without logging in:
PARKLY_NETLIFY_TEST_URL=https://<actual-project>.netlify.app pnpm test:netlify
```

Account access, an exact project, compatible managed PostgreSQL and successful
cloud checks are prerequisites. Account/plan limits and availability guarantees
are those of the selected Netlify/database plans; do not promise unlimited or
uninterrupted hosting. The current Mac version remains the fallback until cutover.

## Official references

- [Netlify CLI](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/)
- [Functions API](https://docs.netlify.com/build/functions/api/)
- [Scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/)
- [PostgreSQL drivers](https://docs.netlify.com/build/data-and-storage/netlify-database/tooling/)
