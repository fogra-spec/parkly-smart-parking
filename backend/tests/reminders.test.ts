import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createECDH,randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {localCluster} from '../scripts/cluster.ts';
import {seedFixtures} from '../scripts/seed.ts';
import {decryptSubscription} from '../src/push-config.ts';
import {localPushKeys as pushKeys} from '../scripts/local-push-keys.ts';
import {startApi} from '../src/server.ts';
import {startReminderWorker} from '../src/reminder-worker.ts';
import {publicPushAddress,type PushSender} from '../src/web-push.ts';

async function freePort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as {port:number}).port;await new Promise<void>(r=>s.close(()=>r()));return p;}
test('push transport blocks nonpublic address families',()=>{for(const ip of ['127.0.0.1','10.2.3.4','169.254.169.254','192.168.1.2','::1','fd00::1','::ffff:127.0.0.1'])assert.equal(publicPushAddress(ip),false);assert.equal(publicPushAddress('8.8.8.8'),true);assert.equal(publicPushAddress('2606:4700:4700::1111'),true);});
test('durable parking reminder jobs, actual worker and protected session API',{timeout:120000},async t=>{
  const directory=await mkdtemp('/private/tmp/parkly-reminders-test-'),runtime=await localCluster(directory,await freePort());
  const accounts=await seedFixtures(runtime.settings.ownerUrl,runtime.root),keys=(await pushKeys(directory))!;
  const api=await startApi({allowRegistration:true,databaseUrl:runtime.settings.apiUrl,publicOrigin:'http://127.0.0.1:5180',port:0,push:keys,expiryIntervalMs:60000});
  const owner=new pg.Client({connectionString:runtime.settings.ownerUrl});await owner.connect();
  const workers:Awaited<ReturnType<typeof startReminderWorker>>[]=[];
  const attemptPayloads:{id:string;deviceId:string;token:string}[]=[];let http=201;
  const sender:PushSender=async(_subscription,payload)=>{attemptPayloads.push(payload);return{status:http};};
  const worker=await startReminderWorker({databaseUrl:runtime.settings.notificationUrl!,keys,sender,autoStart:false});workers.push(worker);
  const secondWorker=await startReminderWorker({databaseUrl:runtime.settings.notificationUrl!,keys,sender,autoStart:false});workers.push(secondWorker);
  async function request(path:string,method='GET',body?:unknown,cookie='',extra:Record<string,string>={}){const response=await fetch('http://127.0.0.1:'+api.port+'/api/v1'+path,{method,headers:{Origin:'http://127.0.0.1:5180',Cookie:cookie,...(body!==undefined?{'Content-Type':'application/json'}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.json() as any,cookie:response.headers.get('set-cookie')?.split(';')[0]||''};}
  const password='Synthetic-reminder-password-42!',driver=await request('/auth/signup','POST',{email:'reminders@example.test',password,name:'Reminder Test Driver'}),other=await request('/auth/signup','POST',{email:'other-reminders@example.test',password,name:'Other Test Driver'}),cookie=driver.cookie;
  const facilities=(await request('/facilities')).body.facilities,facility=facilities.find((f:any)=>f.code==='p1');
  const start=Math.ceil((Date.now()+7200000)/3600000)*3600000,end=start+3600000;
  const spaces=(await request('/facilities/'+facility.id+'/spaces?start='+start+'&end='+end)).body.spaces;
  async function book(space=spaces[0].id,from=start,until=end,identity=cookie){const held=await request('/holds','POST',{spaceId:space,start:from,end:until,quotedPrice:400,idempotencyKey:randomUUID()},identity);assert.equal(held.status,200);const confirmed=await request('/holds/'+held.body.id+'/confirm','POST',{},identity);assert.equal(confirmed.status,200);return confirmed.body.id as string;}
  const ecdh=createECDH('prime256v1');ecdh.generateKeys();
  const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/parkly-test-'+randomUUID(),keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
  async function register(){const result=await request('/push-subscriptions','POST',{endpoint:subscription.endpoint,p256dh:subscription.keys.p256dh,auth:subscription.keys.auth,label:'Synthetic browser'},cookie);assert.equal(result.status,200);await request('/notifications/preferences','PATCH',{inApp:true,push:true},cookie);return result.body.subscription.id as string;}
  let device=await register(),booking=await book();
  async function due(kind:string,reservation=booking){await owner.query("UPDATE app.reminder_jobs SET due_at=clock_timestamp()-interval '1 second',valid_until=clock_timestamp()+interval '2 minutes',state='pending' WHERE reservation_id=$1 AND version=(SELECT reminder_version FROM app.reservations WHERE id=$1) AND kind=$2",[reservation,kind]);}
  try{
    await t.test('subscription capabilities are encrypted, scoped and not exposed to another account',async()=>{
      const row=(await owner.query('SELECT * FROM app.push_devices WHERE id=$1',[device])).rows[0];assert.ok(!row.ciphertext.includes(subscription.endpoint));assert.ok(!row.ciphertext.includes(subscription.keys.auth));assert.deepEqual(decryptSubscription(row.ciphertext,driver.body.userId,keys.encryptionKey),subscription);
      assert.throws(()=>decryptSubscription(row.ciphertext,other.body.userId,keys.encryptionKey));
      assert.equal((await request('/push-subscriptions/'+device,'DELETE',{},other.cookie)).status,404);
      assert.equal((await request('/push-subscriptions','POST',{endpoint:'https://127.0.0.1/private',p256dh:subscription.keys.p256dh,auth:subscription.keys.auth},cookie)).status,400);
      await assert.rejects(api.db.pool.query('SELECT app.prepare_parking_reminders($1)',[randomUUID()]),(e:any)=>e.code==='42501');
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM app.reminder_jobs WHERE reservation_id=$1',[booking])).rows[0].n,4);
    });
    await t.test('two workers dispatch one event once; capability reveals no account or location details',async()=>{
      await due('30');await Promise.all([worker.tick(),secondWorker.tick()]);assert.equal(attemptPayloads.length,1);
      await Promise.all([worker.tick(),secondWorker.tick()]);assert.equal(attemptPayloads.length,1);
      const payload=attemptPayloads[0],headers={'X-Parkly-Push-Device':payload.deviceId,'X-Parkly-Push-Token':payload.token};
      const view=await request('/push/events/'+payload.id,'GET',undefined,'',headers);assert.equal(view.status,200);assert.equal(view.body.body,'Your parking ends in 30 minutes.');assert.equal(view.body.bookingId,booking);assert.equal(view.body.name,undefined);
      assert.equal((await request('/push/events/'+payload.id,'GET',undefined,'',{...headers,'X-Parkly-Push-Token':'0'.repeat(64)})).status,403);
      assert.equal((await request('/reservations/'+booking)).status,401);
      assert.equal((await request('/push/events/'+payload.id+'/display','POST',{},'',headers)).status,200);
      const d=(await owner.query('SELECT * FROM app.reminder_deliveries WHERE id=$1',[payload.id])).rows[0];assert.equal(d.state,'accepted');assert.equal(d.attempts,1);assert.ok(d.display_requested_at);
    });
    await t.test('transient failure retries on a replacement worker with the same delivery identity',async()=>{
      await due('15');http=503;await worker.tick();const payload=attemptPayloads.at(-1)!;
      assert.equal((await owner.query('SELECT state FROM app.reminder_deliveries WHERE id=$1',[payload.id])).rows[0].state,'retry');
      await owner.query('UPDATE app.reminder_deliveries SET next_attempt_at=clock_timestamp() WHERE id=$1',[payload.id]);http=201;
      await secondWorker.tick();assert.equal(attemptPayloads.at(-1)!.id,payload.id);assert.equal(attemptPayloads.at(-1)!.token,payload.token);
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM app.reminder_attempts WHERE delivery_id=$1',[payload.id])).rows[0].n,2);
    });
    await t.test('a lost acknowledgement recovers an expired lease without inventing a new event',async()=>{
      const original=attemptPayloads[0];
      await owner.query("UPDATE app.reminder_deliveries SET state='sending',lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[original.id]);
      await owner.query("UPDATE app.reminder_attempts SET finished_at=NULL,outcome='started' WHERE delivery_id=$1 AND attempt=1",[original.id]);
      await secondWorker.tick();assert.equal(attemptPayloads.at(-1)!.id,original.id);
      const row=(await owner.query('SELECT outcome FROM app.reminder_attempts WHERE delivery_id=$1 AND attempt=1',[original.id])).rows[0];assert.equal(row.outcome,'unknown_after_worker_loss');
    });
    await t.test('expired subscriptions are disabled and their stored capabilities erased',async()=>{
      await due('5');http=410;await worker.tick();http=201;
      const stored=(await owner.query('SELECT active,ciphertext FROM app.push_devices WHERE id=$1',[device])).rows[0];assert.equal(stored.active,false);assert.equal(stored.ciphertext,null);
      device=await register();
    });
    await t.test('extension availability, server quote and transactional reminder rescheduling',async()=>{
      const blocker=await book(spaces[0].id,end,end+3600000,other.cookie);
      assert.equal((await request('/reservations/'+booking+'/extension-options','GET',undefined,cookie)).body.options[0].available,false);
      assert.equal((await request('/reservations/'+booking+'/extend','POST',{end:end+3600000,idempotencyKey:randomUUID(),quotedTotal:800},cookie)).status,409);
      await request('/reservations/'+blocker+'/cancel','POST',{idempotencyKey:randomUUID()},other.cookie);
      const option=(await request('/reservations/'+booking+'/extension-options','GET',undefined,cookie)).body.options[0];assert.equal(option.available,true);assert.equal(option.addedPrice,400);
      assert.equal((await request('/reservations/'+booking+'/extend','POST',{end:option.end,idempotencyKey:randomUUID(),quotedTotal:999},cookie)).status,409);
      const key=randomUUID();for(let i=0;i<2;i++)assert.equal((await request('/reservations/'+booking+'/extend','POST',{end:option.end,idempotencyKey:key,quotedTotal:option.newTotal},cookie)).status,200);
      assert.equal((await owner.query('SELECT reminder_version FROM app.reservations WHERE id=$1',[booking])).rows[0].reminder_version,2);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM app.reminder_jobs WHERE reservation_id=$1 AND version=2 AND state='pending'",[booking])).rows[0].n,4);
      const payload=attemptPayloads[0];assert.equal((await request('/push/events/'+payload.id,'GET',undefined,'',{'X-Parkly-Push-Device':payload.deviceId,'X-Parkly-Push-Token':payload.token})).status,410);
      await request('/reservations/'+booking+'/cancel','POST',{idempotencyKey:randomUUID()},cookie);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM app.reminder_jobs WHERE reservation_id=$1 AND state='pending'",[booking])).rows[0].n,0);
    });
    await t.test('short-duration fixture runs on a real server timer, expires, and does not dispatch duplicates',async()=>{
      booking=await book(spaces[1].id);
      // Trusted fixture clock compression only; production booking policy stays whole-hour.
      await owner.query("UPDATE app.space_allocations SET starts_at=clock_timestamp()-interval '1 minute',ends_at=clock_timestamp()+interval '4 seconds' WHERE id=(SELECT allocation_id FROM app.reservations WHERE id=$1)",[booking]);
      await owner.query("UPDATE app.reminder_jobs SET due_at=clock_timestamp()+CASE kind WHEN '30' THEN interval '0 seconds' WHEN '15' THEN interval '0.5 seconds' ELSE interval '1 second' END,valid_until=clock_timestamp()+interval '15 seconds',state='pending' WHERE reservation_id=$1 AND version=(SELECT reminder_version FROM app.reservations WHERE id=$1) AND kind<>'end'",[booking]);
      const automatic=await startReminderWorker({databaseUrl:runtime.settings.notificationUrl!,keys,sender,intervalMs:100});workers.push(automatic);
      const deadline=Date.now()+12000;let n=0;
      while(Date.now()<deadline){const row=(await owner.query("SELECT count(*)::int AS n FROM app.reminder_deliveries d JOIN app.reminder_jobs j ON j.id=d.job_id WHERE j.reservation_id=$1 AND d.state='accepted'",[booking])).rows[0];n=row.n;if(n===4)break;await delay(100);}
      assert.equal(n,4);await automatic.close();workers.splice(workers.indexOf(automatic),1);
      assert.equal((await owner.query('SELECT status FROM app.reservations WHERE id=$1',[booking])).rows[0].status,'expired');
      const before=attemptPayloads.length;await Promise.all([worker.tick(),secondWorker.tick()]);assert.equal(attemptPayloads.length,before);
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM app.parking_sessions WHERE reservation_id=$1',[booking])).rows[0].n,0);
    });
    await t.test('open operator sessions do not consume the bounded expiry cleanup batch',async()=>{
      const reserved=await book(spaces[6].id),held=await request('/holds','POST',{spaceId:spaces[7].id,start,end,quotedPrice:400,idempotencyKey:randomUUID()},cookie);assert.equal(held.status,200);
      await owner.query("UPDATE app.space_allocations SET starts_at=clock_timestamp()-interval '1 minute',ends_at=clock_timestamp()+interval '1 minute' WHERE id=(SELECT allocation_id FROM app.reservations WHERE id=$1)",[reserved]);
      await owner.query("SELECT set_config('parkly.user_id',$1,false)",[accounts[1].id]);
      await owner.query('SELECT app.record_session($1,false)',[reserved]);
      await owner.query("UPDATE app.space_allocations SET ends_at=clock_timestamp()-interval '1 second' WHERE id=(SELECT allocation_id FROM app.reservations WHERE id=$1)",[reserved]);
      await owner.query("UPDATE app.holds SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[held.body.id]);
      assert.equal(await api.db.call(null,'SELECT app.expire_due() AS result'),1);
      assert.equal((await owner.query('SELECT state FROM app.holds WHERE id=$1',[held.body.id])).rows[0].state,'expired');
      assert.equal((await owner.query('SELECT state FROM app.parking_sessions WHERE reservation_id=$1',[reserved])).rows[0].state,'active');
      await owner.query('SELECT app.record_session($1,true)',[reserved]);
    });
    await t.test('preferences disable thresholds and logout revokes this session’s devices',async()=>{
      const reserved=await book(spaces[2].id);await request('/notifications/preferences','PATCH',{inApp:true,push:true,remind30:false},cookie);
      await due('30',reserved);const before=attemptPayloads.length;await worker.tick();assert.equal(attemptPayloads.length,before);
      const own=(await request('/parking-session?booking='+reserved,'GET',undefined,cookie)).body;assert.ok(own.booking.floor_name);assert.ok(own.booking.space_label);assert.equal((await request('/parking-session?booking='+reserved,'GET',undefined,other.cookie)).status,404);
      await request('/auth/logout','POST',{},cookie);assert.equal((await owner.query('SELECT active FROM app.push_devices WHERE id=$1',[device])).rows[0].active,false);
    });
    await t.test('actual encrypted Web Push transport attempts an invalid synthetic endpoint',{skip:process.env.PARKLY_PUSH_NETWORK_TEST!=='1'},async()=>{
      // No real subscriber or personal data: a rejected provider request is an
      // actual transport attempt, never a claim that a device received a push.
      const signed=await request('/auth/login','POST',{email:'reminders@example.test',password});
      const registered=await request('/push-subscriptions','POST',{endpoint:subscription.endpoint,p256dh:subscription.keys.p256dh,auth:subscription.keys.auth,label:'Synthetic transport probe'},signed.cookie);assert.equal(registered.status,200);
      await request('/notifications/preferences','PATCH',{inApp:true,push:true},signed.cookie);
      const reserved=await book(spaces[3].id,start,end,signed.cookie);
      const queued=await request('/notifications/test','POST',{bookingId:reserved,deviceId:registered.body.subscription.id,idempotencyKey:randomUUID()},signed.cookie);assert.equal(queued.status,200);
      const actual=await startReminderWorker({databaseUrl:runtime.settings.notificationUrl!,keys,autoStart:false});workers.push(actual);await actual.tick();
      const row=(await owner.query('SELECT state,attempts,last_http_status,last_error_code FROM app.reminder_deliveries WHERE job_id=$1',[queued.body.id])).rows[0];
      assert.equal(row.attempts,1);assert.ok(['failed','retry'].includes(row.state));assert.ok(row.last_http_status===null||row.last_http_status>=400);
      console.log('Synthetic real Web Push worker attempt:',row.last_http_status?'HTTP '+row.last_http_status:row.last_error_code,'— no device delivery claimed');
    });
  }finally{await Promise.all(workers.map(w=>w.close()));await owner.end();await api.close();await runtime.cluster.stop();}
});
