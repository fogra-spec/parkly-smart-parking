# Vercel preparation — no deployment performed

The course prototype remains local. Uploading private source to GitHub does not publish a website. Use these instructions only after a separate deployment authorization, with fictional data, restricted test access and no payment card or paid plan. If free service terms require payment details, keep using localhost.

## Actual architecture and build target

The primary local runtime is Next-compatible App Router on Vinext/Vite + Cloudflare Workers with a separate Node API. Its direct `cloudflare:workers` imports cannot be uploaded as a native Next.js Vercel build unchanged. The repository therefore includes a small alternative Vercel target that preserves all existing business code:

- Root Directory: repository root (`.`), not `app/`, `backend/` or `mobile/`.
- Framework Preset: Other (`vercel.json` sets `framework: null`).
- Node: 24.x. Package manager: pnpm 10.28.0 from package.json.
- Install Command: `pnpm install --frozen-lockfile && pnpm --dir backend install --frozen-lockfile --ignore-scripts`.
- Build Command: `pnpm build:vercel`.
- Output Directory: `dist-vercel`.
- Browser entry: existing `netlify/main.tsx` reused by `vercel/vite.config.ts`.
- API: Web-standard Node function `api/parkly.ts`; rewrites preserve v1 resource paths, request method/body, query strings, cookies and exact Origin enforcement.
- Business logic: same `createHttpHandler`, PostgreSQL transactions, RLS and compatibility facade as the other adapters. Public registration remains disabled.

Vercel configuration, API routing, static build and isolated PostgreSQL tests can be verified locally. A real `vercel build`/deployment, function bundle tracing and hosted smoke test still need a Vercel account and are not claimed here. .vercelignore and function exclusions prevent private `.local`/`.env` data entering uploaded source/function bundles. Do not upload a manually assembled folder containing those files.

Official references: [Node functions](https://vercel.com/docs/functions/runtimes/node-js), [vercel.json configuration](https://vercel.com/docs/project-configuration/vercel-json).

## Database: existing PostgreSQL, optional Supabase hosting

There is currently **no Supabase Auth integration** in the application. Do not enter a Supabase service-role key as a Parkly API credential, assume Supabase browser auth is connected, or replace the tested auth/RLS schemas blindly. Local launch provisions PostgreSQL automatically.

If Supabase is chosen solely to host PostgreSQL later:

1. Use a new dedicated project/database with fictional data; inspect existing schemas and back up before applying anything. Parkly creates its own `auth` and `app` schemas, including `auth.sessions`; Supabase also owns an `auth` schema, so **direct migration into its standard database is not currently validated and may conflict**. Stop on a conflict; do not drop provider schemas. A reviewed schema-namespace migration or separate compatible PostgreSQL database is required first.
2. The migration owner needs permission for btree_gist, roles, schemas, RLS and checked SECURITY DEFINER functions. Verify provider support before provisioning.
3. Follow `backend/README.md` for a separate non-owner, NOSUPERUSER/NOBYPASSRLS runtime login and verify-full TLS. Neither a database owner credential nor a Supabase service-role key may be DATABASE_URL.
4. Run `pnpm --dir backend migrate` from a trusted terminal with a private injected MIGRATION_DATABASE_URL. Vercel install/build must never migrate or seed a production database.
5. Provision fictional test accounts through a reviewed owner operation; the automatic local seed intentionally refuses a non-loopback database. A remote account-provisioning flow and Supabase Auth migration are not implemented here.

This database compatibility work is a genuine remaining deployment prerequisite. The included Vercel build target does not imply that Supabase is configured or the application is ready for a one-click hosted launch.

## Future Vercel project import and runtime secrets

Once separately authorized and the database is ready, import the private GitHub repository in Vercel, retain the root/build settings above, and keep preview/production access restricted. Check the current plan's access restrictions and limits first; do not assume a private GitHub repository makes a website private.

Configure server-side variables in Vercel settings, never in the repository:

| Variable | Purpose |
|---|---|
| DATABASE_URL | Restricted API PostgreSQL login, verify-full TLS |
| PARKLY_PUBLIC_ORIGIN | Exact approved HTTPS origin, without trailing slash; never localhost in hosted production |
| PARKLY_VAPID_PUBLIC_KEY | Public VAPID key, if push enabled |
| PARKLY_PUSH_ENCRYPTION_KEY | Server-only shared 32-byte encryption secret |

The adapter connects directly to PostgreSQL; PARKLY_BACKEND_URL is not used in this target. The native PostgreSQL development cluster is not started on Vercel. No production connection string or secret is embedded into browser bundles.

## Reminder worker, VAPID and PWA

Do not start a perpetual worker inside a short-lived Vercel request or promise a cron that is not configured. `vercel.json` intentionally adds no schedule. Reliable reminder delivery requires a separately supervised restricted worker (`backend/deploy/parkly-reminders.service`) with PARKLY_NOTIFICATION_DATABASE_URL, PARKLY_VAPID_PUBLIC_KEY, PARKLY_VAPID_PRIVATE_KEY, PARKLY_VAPID_SUBJECT and PARKLY_PUSH_ENCRYPTION_KEY. The worker must not depend on the development laptop. Only the worker needs the private VAPID key. Review a free, cardless worker option before any deployment; otherwise keep the full stack local.

Local `pnpm --dir backend push:keys` generates keys in ignored backend/.local/.env without printing them. Browser permission must be granted by explicit user action. HTTPS/PWA/OS restrictions and actual physical-device testing still apply. Immediate booking confirmation/cancellation pushes for both roles remain unimplemented; the current durable sender handles driver parking-end reminders. See NOTIFICATIONS_DEPLOYMENT.md for implementation semantics.

Before declaring any future deployment successful, verify the real HTTPS URL, restricted access, both test roles, persisted booking/cancellation, operator visibility, concurrency rejection, PWA assets and actual worker/device delivery. Do not use hosted real data or payments.
