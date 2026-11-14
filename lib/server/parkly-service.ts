import type { Booking, Lot, ParklyData, User } from '../contracts';
import { validateBookingWindow } from '../booking';
import { auditedMutation, database, ensureDemoFixtures } from './database';
import { currentUser, requestAuthMode, clearSession, createDemoSession, sessionCookie } from './identity';
import { actionSchema, validateMutationRequest } from './validation';
import { createBookingSql, updateInventorySql } from './booking-sql';

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff', ...headers,
  } });
}
class ServiceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(status: number, message: string): never { throw new ServiceError(status, message); }
function failure(error: unknown): Response {
  if (error instanceof ServiceError) return json({ error: error.message }, error.status);
  console.error('Parkly database operation failed. Check the binding and pending migrations.');
  return json({ error: 'Service temporarily unavailable. Please try again.' }, 503);
}
export async function readState(req: Request): Promise<Response> {
  try {
    const mode = requestAuthMode(req);
    await ensureDemoFixtures(mode);
    const user = await currentUser(req), now = Date.now(), db = database();
    const lots = await db.prepare(`SELECT l.*, MAX(0, l.capacity - (
      SELECT COUNT(*) FROM bookings b WHERE b.lot_id=l.id AND b.status='confirmed'
      AND b.start<=? AND b.end>?)) AS available FROM lots l
      WHERE l.approved=1 OR ?='admin' OR (?='operator' AND l.owner=?)`)
      .bind(now, now, user?.role || '', user?.role || '', user?.id || '').all<Lot>();
    const bookings = user ? (await db.prepare(`SELECT b.*,l.name FROM bookings b
      JOIN lots l ON l.id=b.lot_id WHERE b.user_id=? OR ?='admin'
      OR (?='operator' AND l.owner=?) ORDER BY b.created DESC`)
      .bind(user.id, user.role, user.role, user.id).all<Booking>()).results : [];
    const users = user?.role === 'admin' ? (await db.prepare('SELECT id,name,role,active FROM users').all<User>()).results : [];
    const favorites = user ? (await db.prepare('SELECT lot_id FROM favorites WHERE user_id=?')
      .bind(user.id).all<{ lot_id: string }>()).results : [];
    const result: ParklyData = { user, lots: lots.results, bookings, users, favorites,
      auth: { mode, signInPath: '/signin-with-chatgpt?return_to=%2F%23driver', signOutPath: '/signout-with-chatgpt?return_to=%2F' } };
    return json(result);
  } catch (error) { return failure(error); }
}
export async function mutate(req: Request): Promise<Response> {
  try {
    const invalid = validateMutationRequest(req);
    if (invalid) return json({ error: invalid }, invalid === 'Invalid request origin.' ? 403 : 415);
    const reader = req.body?.getReader();
    if (!reader) return json({ error: 'A JSON body is required.' }, 400);
    let size = 0, text = '';
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return json({ error: 'Request too large.' }, 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let body: unknown;
    try { body = JSON.parse(text); } catch { return json({ error: 'Invalid JSON.' }, 400); }
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return json({ error: 'Invalid request. Check the required fields and values.' }, 400);
    const a = parsed.data, mode = requestAuthMode(req), db = database();
    await ensureDemoFixtures(mode);
    if (a.action === 'login') {
      if (mode !== 'demo') fail(403, 'Shared demo login is disabled. Use the configured sign-in provider.');
      const account = await db.prepare('SELECT active FROM users WHERE id=?').bind(a.role).first<User>();
      if (!account?.active) fail(403, 'This demo account is disabled.');
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(req, await createDemoSession(req, a.role)) });
    }
    const u = await currentUser(req);
    if (!u) fail(401, mode === 'demo' ? 'Choose a demo account to continue.' : 'Sign in to continue.');
    if (a.action === 'logout') {
      if (mode !== 'demo') fail(400, 'Use the identity provider sign-out link.');
      await clearSession(req);
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(req) });
    }
    if (a.action === 'book') {
      if (u.role !== 'driver') fail(403, 'A driver account is required to reserve.');
      const replay = async () => a.idempotencyKey ? db.prepare(`SELECT * FROM bookings
        WHERE user_id=? AND idempotency_key=?`).bind(u.id, a.idempotencyKey).first<Booking>() : null;
      const respondReplay = (b: Booking) => {
        if (b.lot_id !== a.id || b.start !== a.start || b.end !== a.end ||
            (a.quotedPrice !== undefined && b.hourly_price !== a.quotedPrice)) fail(409, 'This request key was used for different booking details.');
        return json({ ok: true, id: b.id, total: b.total, status: b.status, replayed: true });
      };
      const previous = await replay();
      if (previous) return respondReplay(previous);
      try { validateBookingWindow(a.start, a.end); } catch (e) { fail(400, (e as Error).message); }
      const lot = await db.prepare('SELECT * FROM lots WHERE id=? AND approved=1').bind(a.id).first<Lot>();
      if (!lot) fail(404, 'Listing is not available.');
      const id = 'PK-' + crypto.randomUUID().toUpperCase();
      const result = await auditedMutation(db.prepare(createBookingSql)
        .bind(id, u.id, lot.id, a.start, a.end, Date.now(), a.idempotencyKey ?? null, a.quotedPrice ?? null), u.id, 'booking.created', id);
      if (!result.meta.changes) {
        const raced = await replay();
        if (raced) return respondReplay(raced);
        fail(409, 'Availability or price changed. Refresh the details and try again.');
      }
      const stored = await db.prepare('SELECT total FROM bookings WHERE id=?').bind(id).first<{ total: number }>();
      return json({ ok: true, id, total: stored!.total });
    }
    if (a.action === 'cancel' || a.action === 'complete' || a.action === 'operatorCancel') {
      const b = await db.prepare('SELECT b.*,l.owner FROM bookings b JOIN lots l ON l.id=b.lot_id WHERE b.id=?')
        .bind(a.id).first<Booking & { owner: string }>();
      if (!b) fail(404, 'Booking not found.');
      if (a.action === 'cancel' && (u.role !== 'driver' || b.user_id !== u.id)) fail(403, 'You can only cancel your own booking.');
      if (a.action !== 'cancel' && !(u.role === 'admin' || u.role === 'operator' && b.owner === u.id)) fail(403, 'Owning operator access required.');
      const target = a.action === 'complete' ? 'completed' : a.action === 'operatorCancel' ? 'operator_cancelled' : 'cancelled';
      if (b.status === target) return json({ ok: true, status: target, replayed: true });
      if (b.status !== 'confirmed') fail(409, 'This booking has already changed. Refresh its status.');
      const now = Date.now();
      if (a.action === 'complete' && b.end > now) fail(400, 'Complete a reservation only after its end time.');
      if (a.action === 'cancel' && b.start <= now) fail(400, 'Cancel before the start. Contact the operator after that.');
      const result = await auditedMutation(db.prepare(`UPDATE bookings SET status=?
        WHERE id=? AND status='confirmed' AND (?!='cancel' OR start>?) AND (?!='complete' OR end<=?)`)
        .bind(target, b.id, a.action, now, a.action, now), u.id, 'booking.' + target, b.id);
      if (!result.meta.changes) fail(409, 'Booking status changed. Refresh and try again.');
      return json({ ok: true, status: target });
    }
    if (a.action === 'inventory') {
      const lot = await db.prepare('SELECT * FROM lots WHERE id=?').bind(a.id).first<Lot>();
      if (u.role !== 'operator' || lot?.owner !== u.id) fail(403, 'Only the owning operator can edit this listing.');
      const result = await auditedMutation(db.prepare(updateInventorySql)
        .bind(Date.now(), a.capacity, a.price, u.id, a.id), u.id, 'lot.inventory_updated', a.id);
      if (!result.meta.changes) fail(409, 'Capacity cannot be below peak reserved inventory.');
      return json({ ok: true });
    }
    if (a.action === 'favorite') {
      if (u.role !== 'driver') fail(403, 'Driver role required.');
      const lot = await db.prepare('SELECT id FROM lots WHERE id=? AND approved=1').bind(a.id).first();
      if (!lot) fail(404, 'Listing unavailable.');
      const stmt = a.enabled ? db.prepare('INSERT OR IGNORE INTO favorites (id,user_id,lot_id) VALUES (?,?,?)').bind(u.id + ':' + a.id, u.id, a.id)
        : db.prepare('DELETE FROM favorites WHERE user_id=? AND lot_id=?').bind(u.id, a.id);
      await auditedMutation(stmt, u.id, 'favorite.' + (a.enabled ? 'saved' : 'removed'), a.id);
      return json({ ok: true });
    }
    if (a.action === 'profile') {
      await auditedMutation(db.prepare('UPDATE users SET name=? WHERE id=?').bind(a.name, u.id), u.id, 'profile.updated', u.id);
      return json({ ok: true });
    }
    if (u.role !== 'admin') fail(403, 'Administrator access required.');
    if (a.action === 'approval') {
      const result = await auditedMutation(db.prepare('UPDATE lots SET approved=? WHERE id=?').bind(a.enabled ? 1 : 0, a.id), u.id, 'lot.approval_updated', a.id);
      if (!result.meta.changes) fail(404, 'Listing not found.');
    }
    if (a.action === 'user') {
      if (a.id === u.id) fail(400, 'You cannot disable your own administrator account.');
      const results = await db.batch([
        db.prepare('UPDATE users SET active=? WHERE id=?').bind(a.enabled ? 1 : 0, a.id),
        db.prepare('INSERT INTO audit_events (id,actor_id,action,target_id,created) SELECT ?,?,?,?,? WHERE changes()>0')
          .bind(crypto.randomUUID(), u.id, 'user.status_updated', a.id, Date.now()),
        db.prepare('DELETE FROM sessions WHERE user_id=? AND ?=0').bind(a.id, a.enabled ? 1 : 0),
      ]);
      if (!results[0].meta.changes) fail(404, 'User not found.');
    }
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
