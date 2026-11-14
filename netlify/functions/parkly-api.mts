import { Database } from '../../backend/src/db.ts';
import { createHttpHandler } from '../../backend/src/http-handler.ts';
import { apiPushConfig } from '../../backend/src/push-config.ts';
import { netlifyHttp } from '../../backend/src/netlify-http.ts';

let runtime: Promise<ReturnType<typeof createHttpHandler>> | undefined;
function getRuntime() {
  return runtime ??= (async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const publicOrigin = process.env.PARKLY_PUBLIC_ORIGIN;
    if (!databaseUrl || !publicOrigin) throw Error('Parkly production database and origin are not configured.');
    // Only the restricted API login is accepted. No migration-owner fallback.
    const push = apiPushConfig();
    const db = new Database(databaseUrl, 4);
    try { await db.assertRestrictedRole(); }
    catch (error) { await db.close(); throw error; }
    return createHttpHandler(db, { publicOrigin, push: push || undefined, workerHeartbeatMs: 150000 });
  })().catch(error => { runtime = undefined; throw error; });
}

const unavailable = () => Response.json({ error: {
  code: 'BACKEND_UNAVAILABLE', message: 'The parking service is unavailable. Please try again.',
} }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });

const forward = netlifyHttp(async (request, ip) => (await getRuntime())(request, ip));
export default async function handler(request: Request, context: { ip?: string }) {
  try {
    return await forward(request, context);
  } catch {
    console.error('Parkly API initialization or request failed. Check private function logs and database configuration.');
    return unavailable();
  }
}

export const config = { path: ['/api/v1/*', '/api/demo', '/api/availability'], preferStatic: false };
