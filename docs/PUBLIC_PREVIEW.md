# Temporary public Parkly preview

This preview shares the current PostgreSQL-backed app while the Mac and its
internet connection remain running. It is not a permanent managed deployment.
Cloudflare Quick Tunnel hostnames change after a restart and have no uptime SLA.
No production database or existing hosted Sites version is changed.

## Services

- Existing local app: `127.0.0.1:5173`; API: `127.0.0.1:5191`.
- Existing PostgreSQL and reminder worker stay local and retain their data.
- Compiled frontend: Wrangler on `127.0.0.1:5181` using `dist/server/wrangler.json`.
- `node scripts/share-gateway.mjs`: loopback `5182`, forwards to the compiled
  frontend only. Do not tunnel the Vite dev server, API, or PostgreSQL directly.
- `cloudflared tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:5182`:
  outbound HTTPS tunnel; no router port forwarding is required.

The gateway reads the exact HTTPS origin from the ignored, private
`.sites-runtime/public-share.json`, shaped as `{"origin":"https://YOUR-TUNNEL-HOST"}`.
Start with `{"origin":null}` before creating a new tunnel. After cloudflared prints
its URL, write that origin into this file. Unknown hosts are rejected. The current
URL is runtime state, deliberately excluded from tracked configuration.

For the compiled frontend, run the existing start command with `--port 5181`:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev \
  --config dist/server/wrangler.json --local --persist-to .wrangler/state \
  --ip 127.0.0.1 --port 5181 --inspector-port 0
```

The production build must use `PARKLY_BACKEND_URL=http://127.0.0.1:5191` and the
existing local backend must retain `PARKLY_PUBLIC_ORIGIN=http://127.0.0.1:5173`.
The gateway validates each mutation against its exact public HTTPS Origin before
translating it to that configured loopback Origin. Requests with missing/wrong
origins or a cross-site Fetch Metadata marker are rejected. Public session cookies
receive `Secure`; HttpOnly and SameSite=Strict remain intact. Database authorization,
input validation, pricing, inventory transactions and reminder processing are
unchanged. Public visitors sign up as drivers; they receive no operator/admin role.

Only compiled public assets and application APIs are routed. Source files, hidden
paths, source maps, environment files and runtime state are excluded. Authentication
and API responses are not cached. The tunnel terminates public TLS at Cloudflare;
the application and encrypted user traffic pass through that service.

## Verification

```sh
node tests/share.integration.mjs
# Optional: use the existing synthetic browser QA account, without printing secrets.
PARKLY_SHARE_TEST_LOGIN=1 node tests/share.integration.mjs
```

Checks cover public HTML, manifest, service worker, icon, facilities, compatibility
API, blocked source/secret paths, unauthenticated booking access, exact-origin CSRF,
server validation, and optional login/Secure cookies/own history/logout. They do not
grant notification permission or claim physical-device push delivery.

Stop cloudflared to remove public access. Stop the gateway and compiled frontend
afterwards; the original local app and database can remain running. Public users'
accounts and reservations are real persistent records in this local demo database.
Do not share staff credentials. The server's existing rate limits aggregate some
anonymous traffic behind this loopback gateway, so this setup is for a small demo,
not a high-volume production launch. For continuous hosting, provision a managed
PostgreSQL database, API service, supervised reminder worker, fixed HTTPS origin,
backups and monitoring per the backend and notification deployment guides.

Cloudflare reference: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
