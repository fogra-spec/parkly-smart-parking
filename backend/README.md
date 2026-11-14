Educational project for the course Business Analysis, Astana IT University. Not a real product or service. All data are fictional.

# Parkly PostgreSQL backend

A real Node.js/TypeScript HTTP API with PostgreSQL transactions, per-space exclusion constraints and row-level policies. Use Node 24+. This package has its own pnpm workspace/lockfile; root website/mobile dependencies are not replaced.

## Local development

From the website directory, install both packages and run the full stack as described in `../README.md`. Or run this package separately:

```bash
cd backend
pnpm install --frozen-lockfile --ignore-scripts
PARKLY_PUBLIC_ORIGIN=http://127.0.0.1:5173 pnpm local
```

Then start the existing website in another terminal:

```bash
PARKLY_BACKEND_URL=http://127.0.0.1:5191 pnpm dev
```

Open the exact configured origin. The launcher creates a native PostgreSQL cluster under ignored `backend/.local/`, with SCRAM passwords, loopback-only TCP, private directories, mode-0600 `.env` credentials and random fixture passwords. It runs the inspected platform package symlink hydration script even when package install scripts are disabled; no global PostgreSQL or root user is installed. The package is a pinned development dependency, not the production database distribution.

Data remains after stopping/restarting. Do not delete/reset `.local/`, run two launchers on it, or share `backend/.local/.env`. Do not change its port without selecting a separate new directory. Optional `PARKLY_PG_DIRECTORY` and `PARKLY_PG_PORT` select an isolated development cluster. The ordinary D1 `.wrangler/state` is not used or modified by this launcher.

Fictional accounts are provisioned locally; `driver@test.local` and `operator@test.local` use random passwords in `backend/.local/.env`. Public registration is disabled. No shared role selector or public admin bootstrap exists in PostgreSQL mode. Demo listings are fictional and physical occupancy is unavailable.

## External PostgreSQL and API service

Use a dedicated Parkly database; these migrations create `app` and `auth` schemas and must not be applied blindly to a database with existing schemas of those names. Back up and inspect first. The migration owner must be able to create `btree_gist`, schemas, policies, functions and the NOLOGIN `parkly_app` role. Some managed providers require their administrator to enable the extension/role first.

1. Provision a trusted migration owner separate from the runtime service. Run migrations with an injected `MIGRATION_DATABASE_URL` (never browser-visible or committed):

```bash
pnpm migrate
```

The runner uses an advisory lock, transactions and SHA-256 checksums recorded in `public.parkly_migrations`. It applies only new files in order. An edited applied file causes failure. Make corrections in a new migration; never reset data to fix a migration.

2. Provision a separate API login using a password from a secret manager. Example SQL contains a placeholder only; do not use it literally:

```sql
CREATE ROLE parkly_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
  PASSWORD '<injected-strong-secret>';
GRANT CONNECT ON DATABASE parkly TO parkly_api;
GRANT parkly_app TO parkly_api;
```

Do not grant ownership, owner-role membership, superuser/BYPASSRLS, CREATE privileges or unrelated privileged group roles. The API checks unsafe role attributes/ownership at startup. Do not use migration-owner credentials as DATABASE_URL.

3. Inject `DATABASE_URL`, `PARKLY_PUBLIC_ORIGIN`, `PARKLY_BACKEND_KEY` and the desired API host/port, then run `pnpm dev` under a supervised service. The standalone command does not run migrations or seed fixtures. Remote DB URLs require `sslmode=verify-full` with a trusted certificate. Remote web origins require HTTPS and a backend key of at least 32 characters. Non-loopback listeners also require that key. Restrict ingress to the website bridge and trusted health monitoring.

4. Configure the Worker bridge with the HTTPS `PARKLY_BACKEND_URL` and the same server-only key using its secret/runtime binding mechanism. Never expose database URLs or the key with NEXT_PUBLIC/VITE variables. Website requests stay same-origin; there is no permissive CORS policy.

5. Bootstrap the first admin through a reviewed, out-of-band owner operation after a specific account exists. Subsequent roles, organization memberships and approvals use authorized admin APIs. Never run `scripts/seed.ts` or the local native launcher against production.

Migrations define the runtime grants and RLS. The API sets the authenticated UUID transaction-locally before queries. Checked SECURITY DEFINER functions have a fixed search path and enforce business/tenant permissions; the trusted migration owner deliberately owns these functions/tables. Do not transfer that ownership to the API role. RLS is defense against application query mistakes, not a promise that compromised service credentials cannot impersonate an identity.

## Maintenance and limits

The running API sweeps expired holds/ended reservations every 15 seconds in bounded SKIP LOCKED batches; availability and booking operations also expire claims on demand. Monitor sweep health. Active operator-recorded sessions require checkout/operational handling rather than automatic completion. No verified occupancy is inferred.

Back up with PostgreSQL-supported tooling and rehearse restoration into a separate environment before production. Keep owner credentials and backups private. Retention/cleanup, external monitoring, restore/failover drills, email verification/recovery, admin MFA and deployment CI remain release work. No backup/PITR availability is claimed by this local launcher.

```bash
pnpm typecheck
pnpm test
```

Tests always create a new temporary native cluster and synthetic accounts. They never read DATABASE_URL to target an existing service. Temporary test data contains generated credentials; it is not a public artifact. API contracts are documented in `../docs/API.md`; architecture and verification are in the adjacent docs directory.

## Durable reminder service

Migrations 009–012 add encrypted per-device subscriptions, versioned reminder jobs, delivery leases/attempt logs, protected generic push views and quoted extensions. Local startup includes this worker; production must run `pnpm worker` as a separately supervised process with a restricted notification login and injected secrets. The API needs only the public VAPID key and shared encryption key; the VAPID private key belongs to the worker. See [deployment instructions](../docs/NOTIFICATIONS_DEPLOYMENT.md).
