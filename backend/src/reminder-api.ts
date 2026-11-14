import {z} from 'zod';
import {createHmac,timingSafeEqual} from 'node:crypto';
import type{Context} from './router.ts';
import {id,parse} from './validation.ts';
import {ApiError} from './errors.ts';
import {encryptSubscription,endpointHash,validateSubscription,vapidId} from './push-config.ts';

export const REMINDER_MESSAGES:Record<string,string>={'30':'Your parking ends in 30 minutes.','15':'Your parking ends soon. Extend if available.','5':'Only 5 minutes remain.',end:'Your parking reservation has ended.',test:'Parkly test reminder. Your server reminder worker is running.'};
export const viewToken=(delivery:string,device:string,key:string)=>createHmac('sha256',Buffer.from(key,'base64url')).update('push-view:'+delivery+':'+device).digest('hex');
export async function reminderRoute(ctx:Context):Promise<unknown|undefined>{
  const{db,user,url,method,body,push,sessionHash}=ctx,path=url.pathname.replace(/^\/api\/v1/,'');
  const event=/^\/push\/events\/([^/]+)(\/display)?$/.exec(path);
  if(event){
    const delivery=parse(id,event[1]),device=parse(id,ctx.pushDevice),token=ctx.pushToken||'';
    if(!push||!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token,'hex'),Buffer.from(viewToken(delivery,device,push.encryptionKey),'hex')))throw new ApiError(403,'INVALID_PUSH_TOKEN','This reminder is not authorized.');
    if(event[2]&&method==='POST'){parse(z.object({}).strict(),body);await db.call(null,'SELECT app.ack_push_display($1,$2) AS result',[delivery,device]);return{ok:true};}
    if(!event[2]&&method==='GET')return db.transaction(null,async c=>{
      const record=(await c.query('SELECT * FROM app.push_event_view($1,$2)',[delivery,device])).rows[0];
      if(!record)throw new ApiError(410,'STALE_REMINDER','This reminder expired or the reservation changed.');
      return{deliveryId:delivery,deviceId:device,bookingId:record.reservation_id,title:'Parkly',body:REMINDER_MESSAGES[record.kind],validUntil:record.valid_until,serverNow:Date.now()};
    });
  }
  const relevant=path.startsWith('/push/')||path.startsWith('/push-subscriptions')||path.startsWith('/notifications/')||path==='/notifications'||path==='/parking-session'||path.endsWith('/extension-options');
  if(!relevant)return undefined;if(!user)throw new ApiError(401,'AUTH_REQUIRED','Sign in to manage your reminders and parking.');
  if(path==='/push/config'&&method==='GET')return db.transaction(user,async c=>{
    const heartbeat=(await c.query('SELECT app.notification_worker_status() AS last')).rows[0].last;
    return{configured:!!push,publicKey:push?.publicKey||null,keyId:push?vapidId(push.publicKey):null,workerHealthy:!!heartbeat&&Date.now()-new Date(heartbeat).getTime()<(ctx.workerHeartbeatMs??30000)};
  });
  if(path==='/push/devices'&&method==='GET')return db.transaction(user,async c=>({devices:(await c.query('SELECT id,label,active,disabled_reason,created_at FROM app.push_devices WHERE user_id=app.uid() ORDER BY created_at DESC LIMIT 20')).rows}));
  if(path==='/push/current'&&method==='POST'){
    const a=parse(z.object({endpoint:z.string().max(2048)}).strict(),body);if(!push)return{device:null};
    return db.transaction(user,async c=>({device:(await c.query('SELECT id,label,active,vapid_key_id FROM app.push_devices WHERE user_id=app.uid() AND endpoint_hash=$1 AND active',[endpointHash(a.endpoint,push.encryptionKey)])).rows[0]||null}));
  }
  if(path==='/push-subscriptions'&&method==='POST'){
    if(!push||!sessionHash)throw new ApiError(503,'PUSH_NOT_CONFIGURED','Push delivery is not configured on this server.');
    const a=parse(z.object({endpoint:z.string().url().max(2048),p256dh:z.string().max(128),auth:z.string().max(64),label:z.string().trim().min(1).max(60).default('This device')}).strict(),body);
    const subscription={endpoint:a.endpoint,keys:{p256dh:a.p256dh,auth:a.auth}};
    if(!validateSubscription(subscription))throw new ApiError(400,'INVALID_SUBSCRIPTION','Use a valid browser subscription from a supported push provider.');
    return db.transaction(user,async c=>({subscription:{id:(await c.query('SELECT app.register_push_device($1,$2,$3,$4,$5) AS id',[sessionHash,endpointHash(a.endpoint,push.encryptionKey),encryptSubscription(subscription,user,push.encryptionKey),vapidId(push.publicKey),a.label])).rows[0].id},delivery:'enabled'}));
  }
  const revoke=/^\/push-subscriptions\/([^/]+)$/.exec(path);
  if(revoke&&method==='DELETE'){parse(z.object({}).strict(),body);await db.call(user,'SELECT app.revoke_push_device($1) AS result',[parse(id,revoke[1])]);return{ok:true};}
  if(path==='/notifications/preferences'&&method==='GET')return db.transaction(user,async c=>({preferences:(await c.query('SELECT in_app,push,remind_30,remind_15,remind_5,remind_end FROM app.notification_preferences WHERE user_id=app.uid()')).rows[0]}));
  if(path==='/notifications/preferences'&&method==='PATCH'){
    const a=parse(z.object({inApp:z.boolean(),push:z.boolean(),remind30:z.boolean().optional(),remind15:z.boolean().optional(),remind5:z.boolean().optional(),remindEnd:z.boolean().optional()}).strict(),body);
    return db.transaction(user,async c=>{await c.query(`INSERT INTO app.notification_preferences(user_id,in_app,push,remind_30,remind_15,remind_5,remind_end)
      VALUES(app.uid(),$1,$2,coalesce($3,true),coalesce($4,true),coalesce($5,true),coalesce($6,true)) ON CONFLICT(user_id) DO UPDATE SET in_app=$1,push=$2,
      remind_30=coalesce($3,app.notification_preferences.remind_30),remind_15=coalesce($4,app.notification_preferences.remind_15),remind_5=coalesce($5,app.notification_preferences.remind_5),remind_end=coalesce($6,app.notification_preferences.remind_end),updated_at=clock_timestamp()`,[a.inApp,a.push,a.remind30??null,a.remind15??null,a.remind5??null,a.remindEnd??null]);return{ok:true};});
  }
  if(path==='/notifications/test'&&method==='POST'){
    const a=parse(z.object({bookingId:id,deviceId:id,idempotencyKey:id}).strict(),body);
    return db.transaction(user,async c=>({id:(await c.query('SELECT app.queue_test_reminder($1,$2,$3) AS id',[a.bookingId,a.deviceId,a.idempotencyKey])).rows[0].id,queued:true}));
  }
  if(path==='/notifications/delivery-history'&&method==='GET')return db.transaction(user,async c=>({deliveries:(await c.query(`SELECT d.id,j.reservation_id,j.kind,j.due_at,d.state,d.attempts,d.last_http_status,d.last_error_code,d.accepted_at,d.display_requested_at
    FROM app.reminder_deliveries d JOIN app.reminder_jobs j ON j.id=d.job_id ORDER BY j.due_at DESC LIMIT 50`)).rows}));
  if(path==='/notifications/reminders'&&method==='GET')return db.transaction(user,async c=>({jobs:(await c.query('SELECT id,reservation_id,kind,due_at,state,reason FROM app.reminder_jobs ORDER BY due_at DESC LIMIT 100')).rows}));
  const extension=/^\/reservations\/([^/]+)\/extension-options$/.exec(path);
  if(extension&&method==='GET')return db.call(user,'SELECT app.parking_extension_options($1) AS result',[parse(id,extension[1])]);
  if(path==='/parking-session'&&method==='GET'){
    const wanted=url.searchParams.get('booking');if(wanted)parse(id,wanted);
    return db.transaction(user,async c=>{
      await c.query('SELECT app.expire_due()');
      const booking=(await c.query(`SELECT r.id,r.reference,r.status,r.total_kzt AS total,f.name,f.address,s.label AS space_label,fl.name AS floor_name,
        (extract(epoch FROM a.starts_at)*1000)::float8 AS start,(extract(epoch FROM a.ends_at)*1000)::float8 AS "end",ps.state AS session_state
        FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id JOIN app.facilities f ON f.id=r.facility_id
        JOIN app.spaces s ON s.id=a.space_id JOIN app.floors fl ON fl.id=s.floor_id LEFT JOIN app.parking_sessions ps ON ps.reservation_id=r.id
        WHERE r.user_id=app.uid() AND ($1::uuid IS NULL OR r.id=$1) ORDER BY CASE WHEN r.status='confirmed' AND a.starts_at<=clock_timestamp() AND a.ends_at>clock_timestamp() THEN 0 WHEN r.status='confirmed' AND a.ends_at>clock_timestamp() THEN 1 ELSE 2 END,a.starts_at DESC LIMIT 1`,[wanted||null])).rows[0]||null;
      if(wanted&&!booking)throw new ApiError(404,'NOT_FOUND','This booking is not available in your account.');
      return{booking,serverNow:Date.now()};
    });
  }
  return undefined;
}
