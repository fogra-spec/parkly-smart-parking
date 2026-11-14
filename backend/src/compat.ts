import { randomUUID } from 'node:crypto';
import { actionSchema } from '../../lib/server/validation.ts';
import { parse, id } from './validation.ts';
import { ApiError } from './errors.ts';
import type { Database } from './db.ts';

export async function compatibilityAction(db: Database, user: string | null, body: unknown): Promise<unknown> {
  const a = parse(actionSchema, body);
  if (!user) throw new ApiError(401,'AUTH_REQUIRED','Sign in to continue.');
  if (a.action==='login') throw new ApiError(403,'PASSWORD_REQUIRED','Use email and password. Roles cannot be selected.');
  if (a.action==='logout') throw new ApiError(400,'USE_AUTH_ROUTE','Use the authentication sign-out endpoint.');
  return db.transaction(user,async c=>{
    const identity = 'id' in a ? parse(id,a.id) : null;
    const invoke = async (sql:string,values:unknown[]) => (await c.query(sql,values)).rows[0]?.result || {ok:true};
    if(a.action==='profile'){
      await c.query('UPDATE app.profiles SET name=$1 WHERE id=app.uid()',[a.name]);return{ok:true};
    }
    if(a.action==='favorite'){
      if(!(await c.query("SELECT app.has_role('driver') AS allowed")).rows[0].allowed)throw new ApiError(403,'DRIVER_REQUIRED','Driver access is required.');
      if(!(await c.query('SELECT id FROM app.facilities WHERE id=$1 AND approved',[identity])).rowCount)throw new ApiError(404,'NOT_FOUND','Facility not found.');
      if(a.enabled)await c.query('INSERT INTO app.favorites(user_id,facility_id) VALUES(app.uid(),$1) ON CONFLICT DO NOTHING',[identity]);
      else await c.query('DELETE FROM app.favorites WHERE user_id=app.uid() AND facility_id=$1',[identity]);return{ok:true};
    }
    if(a.action==='inventory')return invoke('SELECT app.set_inventory($1,$2,$3) AS result',[identity,a.capacity,a.price]);
    if(a.action==='approval')return invoke('SELECT app.admin_approval($1,$2) AS result',[identity,a.enabled]);
    if(a.action==='user')return invoke('SELECT app.admin_user($1,$2) AS result',[identity,a.enabled]);
    if(a.action==='cancel'||a.action==='operatorCancel')return invoke('SELECT app.cancel_reservation($1,$2) AS result',[identity,randomUUID()]);
    if(a.action==='complete')throw new ApiError(409,'SESSION_REQUIRED','Record parking check-in and check-out through the session actions.');
    if(a.action==='book'){
      if(!a.idempotencyKey||a.quotedPrice===undefined)throw new ApiError(400,'REQUEST_KEY_REQUIRED','A request key and price quote are required.');
      const prior=(await c.query('SELECT allocation_id FROM app.holds WHERE user_id=app.uid() AND request_key=$1',[a.idempotencyKey])).rows[0];
      const space=prior?(await c.query('SELECT space_id AS id FROM app.space_allocations WHERE id=$1',[prior.allocation_id])).rows[0]:
        (await c.query('SELECT id FROM app.available_spaces($1,$2,$3) WHERE available LIMIT 1',[identity,new Date(a.start).toISOString(),new Date(a.end).toISOString()])).rows[0];
      if(!space)throw new ApiError(409,'SPACE_UNAVAILABLE','No allocated space is available.');
      const held=(await c.query('SELECT app.hold_space($1,$2,$3,$4,$5) AS result',[space.id,new Date(a.start).toISOString(),new Date(a.end).toISOString(),a.quotedPrice,a.idempotencyKey])).rows[0].result;
      const confirmed=(await c.query('SELECT app.confirm_hold($1) AS result',[held.id])).rows[0].result;
      return {ok:true,...confirmed};
    }
    throw new ApiError(400,'INVALID_ACTION','Unsupported compatibility action.');
  });
}
