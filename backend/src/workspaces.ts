import { z } from 'zod';
import { dashboardSummary } from './summary.ts';
import type { Context } from './router.ts';
import { ApiError } from './errors.ts';
import { id, parse } from './validation.ts';
import { bookingQuery } from './queries.ts';


export async function workspaceRoute(ctx: Context): Promise<unknown | undefined> {
  const { db, user, method, body, url } = ctx;
  const path = url.pathname.replace(/^\/api\/v1/, '').replace(/\/$/, '');
  const matched = ['/dashboard', '/reports', '/reservations', '/operator-applications', '/support', '/admin/system', '/admin/audit', '/admin/users', '/notifications'].includes(path)
    || /^\/support\//.test(path) || /^\/admin\/operator-applications\//.test(path) || /^\/operator\/facilities\/[^/]+\/details$/.test(path);
  if (!matched) return;
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  const call = async (sql: string, args: unknown[]) => db.call(user, sql, args);

  if(path==='/admin/users'&&method==='GET'){
    const a=parse(z.object({limit:z.coerce.number().int().min(1).max(100).default(20),offset:z.coerce.number().int().min(0).max(100000).default(0),q:z.string().max(160).default('')}).strict(),Object.fromEntries(url.searchParams));
    return db.transaction(user,async c=>{
      if(!(await c.query("SELECT app.has_role('admin') AS allowed")).rows[0].allowed)throw new ApiError(403,'ADMIN_REQUIRED','Administrator access is required.');
      const condition=" WHERE ($1='' OR position(lower($1) IN lower(name||' '||id::text))>0)";
      return{users:(await c.query("SELECT id,name,active,(SELECT array_agg(role ORDER BY role) FROM app.user_roles WHERE user_id=p.id) AS roles FROM app.profiles p"+condition+' ORDER BY created_at DESC,id LIMIT $2 OFFSET $3',[a.q.trim(),a.limit,a.offset])).rows,total:(await c.query('SELECT count(*)::int AS total FROM app.profiles'+condition,[a.q.trim()])).rows[0].total};
    });
  }
  if (path === '/admin/audit' && method === 'GET') {
    const a = parse(z.object({limit:z.coerce.number().int().min(1).max(200).default(25),offset:z.coerce.number().int().min(0).max(100000).default(0),q:z.string().max(160).default('')}).strict(),Object.fromEntries(url.searchParams));
    return db.transaction(user,async c=>{
      if(!(await c.query("SELECT app.has_role('admin') AS allowed")).rows[0].allowed)throw new ApiError(403,'ADMIN_REQUIRED','Administrator access is required.');
      const condition=" WHERE ($1='' OR position(lower($1) IN lower(action||' '||target_id))>0)";
      return {audit:(await c.query('SELECT id,actor_id,action,target_id,facility_id,created_at FROM app.audit_logs'+condition+' ORDER BY created_at DESC,id LIMIT $2 OFFSET $3',[a.q.trim(),a.limit,a.offset])).rows,total:(await c.query('SELECT count(*)::int AS total FROM app.audit_logs'+condition,[a.q.trim()])).rows[0].total};
    });
  }
  if (path === '/notifications' && method === 'GET') {
    const a=parse(z.object({limit:z.coerce.number().int().min(1).max(100).default(20),offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict(),Object.fromEntries(url.searchParams));
    return db.transaction(user,async c=>({notifications:(await c.query("SELECT id,event,reservation_id,channel,status,read_at,created_at FROM app.notification_deliveries WHERE user_id=app.uid() AND channel='in_app' ORDER BY created_at DESC,id LIMIT $1 OFFSET $2",[a.limit,a.offset])).rows,total:(await c.query("SELECT count(*)::int AS total FROM app.notification_deliveries WHERE user_id=app.uid() AND channel='in_app'")).rows[0].total}));
  }
  if (path === '/dashboard' && method === 'GET') return db.transaction(user, dashboardSummary);
  if (path === '/reports' && method === 'GET') {
    const filters = parse(z.object({ start: z.coerce.number().int().safe().nonnegative().optional(), end: z.coerce.number().int().safe().nonnegative().optional(), facility: id.optional() }).strict(), Object.fromEntries(url.searchParams));
    if ((filters.start === undefined) !== (filters.end === undefined) || (filters.start !== undefined && filters.end! <= filters.start)) throw new ApiError(400, 'INVALID_WINDOW', 'Choose a valid report start and end.');
    return db.transaction(user, async c => {
      const r = (await c.query(`SELECT count(*)::int AS bookings,
        count(*) FILTER(WHERE status='completed')::int AS completed,
        count(*) FILTER(WHERE status IN ('cancelled','operator_cancelled'))::int AS cancelled,
        coalesce(sum(total_kzt) FILTER(WHERE status='completed'),0)::float8 AS gmv
        FROM app.reservations WHERE (app.can_manage(facility_id) OR (user_id=app.uid() AND NOT app.has_role('operator') AND NOT app.has_role('admin')))
        AND ($1::timestamptz IS NULL OR created_at>=$1) AND ($2::timestamptz IS NULL OR created_at<$2)
        AND ($3::uuid IS NULL OR facility_id=$3)`, [filters.start === undefined ? null : new Date(filters.start).toISOString(), filters.end === undefined ? null : new Date(filters.end).toISOString(), filters.facility || null])).rows[0];
      return { ...r, completedGmv: r.gmv, estimatedCommission: r.gmv * 0.1, estimatedOperatorAllocation: r.gmv * 0.9, currency: 'KZT', scope: 'authorized_records', basis: 'reservation_created_at', payments: 'not_configured', commissionRateAssumption: 0.1, costs: 'not_recorded' };
    });
  }
  if (path === '/reservations' && method === 'GET') {
    const f = parse(z.object({ limit: z.coerce.number().int().min(1).max(200).default(20), offset: z.coerce.number().int().min(0).max(100000).default(0), scope: z.enum(['authorized', 'own', 'managed']).default('authorized'), bucket: z.enum(['all', 'upcoming', 'active', 'past', 'current']).default('all'), q: z.string().max(160).default('') }).strict(), Object.fromEntries(url.searchParams));
    return db.transaction(user, async c => {
      const where = ` WHERE ($1='authorized' OR ($1='own' AND r.user_id=app.uid()) OR ($1='managed' AND app.can_manage(r.facility_id)))
        AND ($2='all' OR ($2='current' AND r.status='confirmed' AND a.ends_at>clock_timestamp()) OR ($2='upcoming' AND r.status='confirmed' AND a.starts_at>clock_timestamp())
          OR ($2='active' AND r.status='confirmed' AND a.starts_at<=clock_timestamp() AND a.ends_at>clock_timestamp())
          OR ($2='past' AND (r.status<>'confirmed' OR a.ends_at<=clock_timestamp())))
        AND ($3='' OR position(lower($3) IN lower(f.name||' '||r.reference||' '||s.label))>0)`;
      const args = [f.scope, f.bucket, f.q.trim()];
      const count = (await c.query('SELECT count(*)::int AS total FROM (' + bookingQuery + where + ') visible', args)).rows[0].total;
      const reservations = (await c.query(bookingQuery + where + ' ORDER BY r.created_at DESC,r.id LIMIT $4 OFFSET $5', [...args, f.limit, f.offset])).rows;
      return { reservations, total: count, limit: f.limit, offset: f.offset, serverNow: Date.now() };
    });
  }
  if (path === '/operator-applications' && method === 'POST') {
    const a = parse(z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().min(10).max(2000), idempotencyKey: id }).strict(), body);
    return call('SELECT app.apply_operator($1,$2,$3) AS result', [a.name, a.description, a.idempotencyKey]);
  }
  if (path === '/operator-applications' && method === 'GET') {
    const a=parse(z.object({limit:z.coerce.number().int().min(1).max(100).default(20),offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict(),Object.fromEntries(url.searchParams));
    return db.transaction(user,async c=>({applications:(await c.query("SELECT * FROM app.operator_applications ORDER BY (status='pending') DESC,created_at DESC,id LIMIT $1 OFFSET $2",[a.limit,a.offset])).rows,total:(await c.query('SELECT count(*)::int AS total FROM app.operator_applications')).rows[0].total}));
  }
  const review = /^\/admin\/operator-applications\/([^/]+)$/.exec(path);
  if (review && method === 'PATCH') {
    const a = parse(z.object({ approved: z.boolean(), note: z.string().trim().min(3).max(2000) }).strict(), body);
    return call('SELECT app.review_operator($1,$2,$3) AS result', [parse(id, review[1]), a.approved, a.note]);
  }
  const details = /^\/operator\/facilities\/([^/]+)\/details$/.exec(path);
  if (details && method === 'PATCH') {
    const a = parse(z.object({ name: z.string().trim().min(2).max(100), area: z.string().trim().min(2).max(160), address: z.string().trim().min(2).max(160), rules: z.string().trim().max(2000), hours: z.string().trim().min(2).max(120) }).strict(), body);
    return call('SELECT app.edit_facility($1,$2,$3,$4,$5,$6) AS result', [parse(id, details[1]), a.name, a.area, a.address, a.rules, a.hours]);
  }
  if (path === '/support' && method === 'POST') {
    const a = parse(z.object({ reservationId: id.nullable().default(null), subject: z.string().trim().min(3).max(120), message: z.string().trim().min(3).max(4000), idempotencyKey: id }).strict(), body);
    return call('SELECT app.open_support($1,$2,$3,$4) AS result', [a.reservationId, a.subject, a.message, a.idempotencyKey]);
  }
  if (path === '/support' && method === 'GET') {
    const a=parse(z.object({limit:z.coerce.number().int().min(1).max(100).default(20),offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict(),Object.fromEntries(url.searchParams));
    return db.transaction(user,async c=>({tickets:(await c.query('SELECT * FROM app.support_tickets ORDER BY updated_at DESC,id LIMIT $1 OFFSET $2',[a.limit,a.offset])).rows,total:(await c.query('SELECT count(*)::int AS total FROM app.support_tickets')).rows[0].total}));
  }
  const ticket = /^\/support\/([^/]+)$/.exec(path);
  if (ticket && method === 'GET') return db.transaction(user, async c => {
    const identity = parse(id, ticket[1]);
    const item = (await c.query('SELECT * FROM app.support_tickets WHERE id=$1', [identity])).rows[0];
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Support case not found.');
    return { ticket: item, messages: (await c.query(`SELECT m.id,m.body,m.created_at,m.author_id,m.staff FROM app.support_messages m WHERE ticket_id=$1 ORDER BY created_at,id LIMIT 500`, [identity])).rows };
  });
  const reply = /^\/support\/([^/]+)\/messages$/.exec(path);
  if (reply && method === 'POST') {
    const a = parse(z.object({ message: z.string().trim().min(3).max(4000), idempotencyKey: id, status: z.enum(['open', 'in_progress', 'resolved']).nullable().default(null) }).strict(), body);
    return call('SELECT app.reply_support($1,$2,$3,$4) AS result', [parse(id, reply[1]), a.message, a.idempotencyKey, a.status]);
  }
  if (path === '/admin/system' && method === 'GET') return db.transaction(user, async c => {
    if (!(await c.query("SELECT app.has_role('admin') AS allowed")).rows[0].allowed) throw new ApiError(403, 'ADMIN_REQUIRED', 'Administrator access is required.');
    const status = (await c.query('SELECT app.operational_status() AS result')).rows[0].result;
    return { database: 'available', ...status, workerHeartbeatMs: ctx.workerHeartbeatMs ?? 60000, payments: 'not_configured', physicalOccupancy: 'not_available' };
  });
  return undefined;
}
