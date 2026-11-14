import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Authentication, cookieToken, authCookie } from './auth.ts';
import { tokenHash } from './password.ts';
import { ApiError, publicError } from './errors.ts';
import { route } from './router.ts';
import { compatibilityAction } from './compat.ts';
import type { Database } from './db.ts';
import type { PushApiConfig } from './push-config.ts';

export type HttpOptions = { publicOrigin: string; backendKey?: string; push?: PushApiConfig; workerHeartbeatMs?: number; allowRegistration?: boolean };

async function jsonBody(request: Request, limit: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'JSON_REQUIRED', 'Use application/json.');
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  // Drain oversized input while bounding retained memory, preserving HTTP errors.
  if (reader) for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size <= limit) chunks.push(part.value);
  }
  if (size > limit) throw new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }
}

// Both the existing Node server and Netlify use the same authentication,
// validation, tenant authorization and transactional booking implementation.
export function createHttpHandler(db: Database, options: HttpOptions) {
  const publicUrl = new URL(options.publicOrigin);
  if (publicUrl.origin !== options.publicOrigin || !['http:', 'https:'].includes(publicUrl.protocol)) {
    throw Error('PARKLY_PUBLIC_ORIGIN must be an exact HTTP(S) origin without a path.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname);
  if (!local && publicUrl.protocol !== 'https:') throw Error('Remote web origins require HTTPS.');
  const auth = new Authentication(db);
  return async (request: Request, clientAddress = 'unknown'): Promise<Response> => {
    const requestId = randomUUID();
    const respond = (status: number, data: unknown, cookie?: string) => Response.json(data, {
      status,
      headers: {
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': requestId, Vary: 'Cookie', ...(cookie ? { 'Set-Cookie': cookie } : {}),
      },
    });
    try {
      if (options.backendKey) {
        const received = request.headers.get('x-parkly-backend-key') || '';
        if (!timingSafeEqual(Buffer.from(tokenHash(received), 'hex'), Buffer.from(tokenHash(options.backendKey), 'hex'))) {
          throw new ApiError(403, 'BACKEND_ACCESS', 'Backend access is not authorized.');
        }
      }
      const url = new URL(request.url), method = request.method;
      if (url.pathname === '/healthz' && method === 'GET') {
        await db.pool.query('SELECT 1'); return respond(200, { ok: true, database: 'postgresql' });
      }
      const token = cookieToken(request.headers.get('cookie') || undefined);
      const user = token ? await db.userForSession(tokenHash(token)) : null;
      const mutation = !['GET', 'HEAD'].includes(method);
      if (mutation) {
        if (request.headers.get('origin') !== options.publicOrigin || request.headers.get('sec-fetch-site') === 'cross-site') {
          throw new ApiError(403, 'INVALID_ORIGIN', 'Invalid request origin.');
        }
        await auth.limit('write:' + (user || clientAddress), 120, 60);
      }
      const layoutWrite = method === 'PATCH' && /^\/api\/v1\/operator\/floors\/[0-9a-f-]+\/layout$/.test(url.pathname);
      const body = mutation ? await jsonBody(request, layoutWrite ? 262144 : 8192) : undefined;
      if (url.pathname === '/api/v1/auth/password' && method === 'POST') {
        if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to change your password.');
        return respond(200, await auth.changePassword(user, body), authCookie('', publicUrl.protocol === 'https:'));
      }
      if (['/api/v1/auth/signup', '/api/v1/auth/login'].includes(url.pathname) && method === 'POST') {
        const signup = url.pathname.endsWith('/signup');
        if (signup && !options.allowRegistration) throw new ApiError(403, 'REGISTRATION_DISABLED', 'Educational prototype: use a pre-provisioned fictional test account.');
        const signed = await auth.signIn(body, signup, clientAddress, token);
        return respond(signup ? 201 : 200, { ok: true, userId: signed.identity }, authCookie(signed.token, publicUrl.protocol === 'https:'));
      }
      if ((url.pathname === '/api/v1/auth/logout' || url.pathname === '/api/v1/compat/action' && (body as { action?: string })?.action === 'logout') && method === 'POST') {
        if (token) await db.pool.query('SELECT auth.close_session($1)', [tokenHash(token)]);
        return respond(200, { ok: true }, authCookie('', publicUrl.protocol === 'https:'));
      }
      if (url.pathname === '/api/v1/compat/action' && method === 'POST') {
        return respond(200, await compatibilityAction(db, user, body));
      }
      return respond(200, await route({
        db, user, url, method, body, push: options.push, workerHeartbeatMs: options.workerHeartbeatMs,
        sessionHash: token ? tokenHash(token) : undefined,
        pushToken: request.headers.get('x-parkly-push-token') || undefined,
        pushDevice: request.headers.get('x-parkly-push-device') || undefined,
      }));
    } catch (error) {
      const safe = publicError(error);
      if (safe.status >= 500) console.error('API operation failed', { requestId, code: (error as { code?: string }).code || 'internal' });
      return respond(safe.status, { error: { code: safe.code, message: safe.message }, requestId });
    }
  };
}
