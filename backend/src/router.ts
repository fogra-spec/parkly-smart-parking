import { z } from 'zod';
import { Database } from './db.ts';
import { state, bookingQuery } from './queries.ts';
import { ApiError } from './errors.ts';
import { id, parse, holdInput, keyInput, extensionInput, inventoryInput, facilityInput } from './validation.ts';
import {reminderRoute} from './reminder-api.ts';
import type{PushApiConfig} from './push-config.ts';
import {floorRoute} from './floors.ts';
import {workspaceRoute} from './workspaces.ts';

export type Context = { db: Database; user: string | null; url: URL; method: string; body: unknown; push?:PushApiConfig; workerHeartbeatMs?:number; sessionHash?:string; pushToken?:string; pushDevice?:string };
const iso = (ms: number) => new Date(ms).toISOString();
export async function route(ctx: Context): Promise<unknown> {
  const { db, user, url, method, body } = ctx;
  const workspaceResult=await workspaceRoute(ctx);if(workspaceResult!==undefined)return workspaceResult;
  const reminderResult=await reminderRoute(ctx);if(reminderResult!==undefined)return reminderResult;
  const floorResult=await floorRoute(ctx);if(floorResult!==undefined)return floorResult;
  const path = url.pathname.replace(/^\/api\/v1/, '').replace(/\/$/, '') || '/';
  const call = async (sql: string, args: unknown[] = []) => {
    const result = await db.call(user, sql, args) as Record<string, unknown> | null;
    // Expiry writes must commit before returning 410, rather than raising inside
    // the transaction and accidentally rolling back the expired hold release.
    if (result?.errorCode === 'HOLD_EXPIRED') throw new ApiError(410, 'HOLD_EXPIRED', String(result.message));
    if(typeof result==='string')return result?{id:result}:{ok:true};
    return result ?? { ok: true };
  };
  if (path === '/compat/state' && method === 'GET') return db.transaction(user, state);
  if (path === '/auth/me' && method === 'GET') return db.transaction(user, async c => ({ user: (await state(c)).user }));
  if (path === '/facilities' && method === 'GET') {
    const filters = parse(z.object({ q: z.string().max(160).default(''), type: z.enum(['All','Covered','Outdoor']).default('All'), maxPrice: z.coerce.number().int().min(0).max(100000).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(10000).default(0) }).strict(), Object.fromEntries(url.searchParams));
    return db.transaction(user, async c => {
      const data = await state(c);
      const matches = data.lots.filter(f => f.approved && `${f.name} ${f.area}`.toLowerCase().includes(filters.q.trim().toLowerCase()) &&
        (filters.type === 'All' || f.type === filters.type) && (filters.maxPrice === undefined || f.price <= filters.maxPrice));
      return { facilities: matches.slice(filters.offset,filters.offset+filters.limit), total: matches.length, currency:'KZT', physicalOccupancy:'not_available' };
    });
  }
  const spaces = /^\/facilities\/([^/]+)\/spaces$/.exec(path);
  if (spaces && method === 'GET') {
    const facility = parse(id, spaces[1]);
    const window = parse(z.object({ start: z.coerce.number().int().safe().nonnegative(), end: z.coerce.number().int().safe().nonnegative() }).strict(), Object.fromEntries(url.searchParams));
    if (window.end <= window.start || window.end-window.start > 86400000) throw new ApiError(400,'INVALID_WINDOW','Invalid availability window.');
    return db.transaction(user, async c => ({ spaces: (await c.query('SELECT * FROM app.available_spaces($1,$2,$3)', [facility, iso(window.start), iso(window.end)])).rows,
      source:'allocated_inventory', physicalOccupancy:'not_available' }));
  }
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  if(path==='/operator/organizations'&&method==='GET')return db.transaction(user,async c=>({operators:(await c.query('SELECT id,name,active FROM app.operators ORDER BY name')).rows}));
  if(path==='/admin/operators'&&method==='GET')return db.transaction(user,async c=>{
    if(!(await c.query("SELECT app.has_role('admin') AS allowed")).rows[0].allowed)throw new ApiError(403,'ADMIN_REQUIRED','Administrator access is required.');
    return{operators:(await c.query('SELECT id,name,active FROM app.operators ORDER BY name')).rows};
  });
  const structure=/^\/operator\/facilities\/([^/]+)\/structure$/.exec(path);
  if(structure&&method==='GET')return db.transaction(user,async c=>{
    const identity=parse(id,structure[1]);
    if(!(await c.query('SELECT app.can_manage($1) AS allowed',[identity])).rows[0].allowed)throw new ApiError(403,'FACILITY_ACCESS','Facility management access is required.');
    return{floors:(await c.query('SELECT id,name FROM app.floors WHERE facility_id=$1 ORDER BY name',[identity])).rows,
      spaces:(await c.query('SELECT id,label,active,floor_id FROM app.spaces WHERE facility_id=$1 ORDER BY label',[identity])).rows,
      blocks:(await c.query(`SELECT b.id,b.reason,a.starts_at,a.ends_at,s.label FROM app.maintenance_blocks b JOIN app.space_allocations a ON a.id=b.allocation_id JOIN app.spaces s ON s.id=a.space_id WHERE b.facility_id=$1 AND a.released_at IS NULL ORDER BY a.starts_at LIMIT 100`,[identity])).rows};
  });
  if (path === '/holds' && method === 'POST') {
    const a = parse(holdInput, body);
    return call("SELECT app.hold_space($1,$2,$3,$4,$5)||jsonb_build_object('serverNow',extract(epoch FROM clock_timestamp())*1000) AS result", [a.spaceId, iso(a.start), iso(a.end), a.quotedPrice, a.idempotencyKey]);
  }
  if (path === '/holds' && method === 'GET') return db.transaction(user, async c => ({ holds: (await c.query(`SELECT h.id,h.state,h.total_kzt AS total,h.expires_at,f.name,s.label AS space_label,
    a.starts_at,a.ends_at,a.facility_id,a.space_id FROM app.holds h JOIN app.space_allocations a ON a.id=h.allocation_id JOIN app.facilities f ON f.id=a.facility_id JOIN app.spaces s ON s.id=a.space_id
    WHERE h.state='held' AND h.expires_at>clock_timestamp() ORDER BY h.created_at DESC LIMIT 50`)).rows }));
  const hold = /^\/holds\/([^/]+)\/(confirm|cancel)$/.exec(path);
  if (hold && method === 'POST') {
    parse(z.object({}).strict(), body);
    return call(hold[2] === 'confirm' ? 'SELECT app.confirm_hold($1) AS result' : 'SELECT app.release_hold($1) AS result', [parse(id, hold[1])]);
  }
  const reservation = /^\/reservations\/([^/]+)$/.exec(path);
  if (reservation && method === 'GET') return db.transaction(user, async c => {
    const identity = parse(id, reservation[1]);
    const booking = (await c.query(bookingQuery+' WHERE r.id=$1', [identity])).rows[0];
    if (!booking) throw new ApiError(404,'NOT_FOUND','Reservation not found.');
    const history = (await c.query('SELECT from_status,to_status,created_at FROM app.booking_status_history WHERE reservation_id=$1 ORDER BY created_at,id', [identity])).rows;
    const extensions = (await c.query('SELECT old_end,new_end,added_kzt,created_at FROM app.reservation_extensions WHERE reservation_id=$1 ORDER BY created_at', [identity])).rows;
    return { reservation: booking, history, extensions };
  });
  const action = /^\/reservations\/([^/]+)\/(cancel|extend|check-in|check-out)$/.exec(path);
  if (action && method === 'POST') {
    const identity = parse(id, action[1]);
    if (action[2] === 'cancel') return call('SELECT app.cancel_reservation($1,$2) AS result', [identity, parse(keyInput, body).idempotencyKey]);
    if (action[2] === 'extend') { const a = parse(extensionInput, body); return a.quotedTotal===undefined?call('SELECT app.extend_reservation($1,$2,$3) AS result', [identity, iso(a.end), a.idempotencyKey]):call('SELECT app.extend_quoted_reservation($1,$2,$3,$4) AS result',[identity,iso(a.end),a.idempotencyKey,a.quotedTotal]); }
    parse(z.object({}).strict(), body);
    return call('SELECT app.record_session($1,$2) AS result', [identity, action[2] === 'check-out']);
  }
  if (path === '/sessions' && method === 'GET') return db.transaction(user, async c => ({ sessions: (await c.query(`SELECT ps.*,f.name,s.label AS space_label FROM app.parking_sessions ps
    JOIN app.facilities f ON f.id=ps.facility_id JOIN app.reservations r ON r.id=ps.reservation_id JOIN app.space_allocations a ON a.id=r.allocation_id
    JOIN app.spaces s ON s.id=a.space_id ORDER BY ps.checked_in_at DESC LIMIT 200`)).rows }));
  const inventory = /^\/operator\/facilities\/([^/]+)\/inventory$/.exec(path);
  if (inventory && method === 'PATCH') { const a = parse(inventoryInput, body); return call('SELECT app.set_inventory($1,$2,$3) AS result', [parse(id,inventory[1]),a.capacity,a.price]); }
  const floors = /^\/operator\/facilities\/([^/]+)\/floors$/.exec(path);
  if (floors && method === 'POST') return call('SELECT app.add_floor($1,$2) AS result', [parse(id,floors[1]),parse(z.object({name:z.string().trim().min(1).max(60)}).strict(),body).name]);
  const newSpace = /^\/operator\/facilities\/([^/]+)\/spaces$/.exec(path);
  if (newSpace && method === 'POST') { const a = parse(z.object({floorId:id,label:z.string().trim().min(1).max(40)}).strict(),body); return call('SELECT app.add_space($1,$2,$3) AS result',[parse(id,newSpace[1]),a.floorId,a.label]); }
  const block = /^\/operator\/spaces\/([^/]+)\/blocks$/.exec(path);
  if (block && method === 'POST') { const a = parse(z.object({start:z.number().int().safe(),end:z.number().int().safe(),reason:z.string().trim().min(2).max(240)}).strict(),body); return call('SELECT app.block_space($1,$2,$3,$4) AS result',[parse(id,block[1]),iso(a.start),iso(a.end),a.reason]); }
  const release = /^\/operator\/blocks\/([^/]+)\/cancel$/.exec(path);
  if (release && method === 'POST') { parse(z.object({}).strict(),body); return call('SELECT app.release_block($1) AS result',[parse(id,release[1])]); }
  if (path === '/operator/facilities' && method === 'POST') {
    const a = parse(facilityInput,body);
    return call('SELECT app.create_facility($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result',[a.operatorId,a.name,a.area,a.address,a.lat,a.lng,a.type,a.price,a.capacity]);
  }
  const approval = /^\/admin\/facilities\/([^/]+)\/approval$/.exec(path);
  if (approval && method === 'PATCH') return call('SELECT app.admin_approval($1,$2) AS result',[parse(id,approval[1]),parse(z.object({approved:z.boolean()}).strict(),body).approved]);
  if (path === '/admin/operators' && method === 'POST') return call('SELECT app.admin_operator($1) AS result',[parse(z.object({name:z.string().trim().min(2).max(100)}).strict(),body).name]);
  const member = /^\/admin\/operators\/([^/]+)\/members$/.exec(path);
  if (member && method === 'POST') { const a=parse(z.object({userId:id,enabled:z.boolean()}).strict(),body);return call('SELECT app.admin_membership($1,$2,$3) AS result',[parse(id,member[1]),a.userId,a.enabled]); }
  const access = /^\/admin\/users\/([^/]+)\/(active|roles)$/.exec(path);
  if (access && method === 'PATCH') {
    if (access[2]==='active') return call('SELECT app.admin_user($1,$2) AS result',[parse(id,access[1]),parse(z.object({active:z.boolean()}).strict(),body).active]);
    const a=parse(z.object({role:z.enum(['driver','operator','admin']),enabled:z.boolean()}).strict(),body);
    return call('SELECT app.admin_role($1,$2,$3) AS result',[parse(id,access[1]),a.role,a.enabled]);
  }
  if (path === '/notifications' && method === 'GET') return db.transaction(user,async c=>({notifications:(await c.query('SELECT id,event,channel,status,read_at,created_at FROM app.notification_deliveries WHERE user_id=app.uid() ORDER BY created_at DESC LIMIT 100')).rows}));
  const readNotification=/^\/notifications\/([^/]+)\/read$/.exec(path);
  if(readNotification&&method==='POST'){parse(z.object({}).strict(),body);return call('SELECT app.read_notification($1) AS result',[parse(id,readNotification[1])]);}
  throw new ApiError(404,'NOT_FOUND','API route not found.');
}
