import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { localCluster } from '../scripts/cluster.ts';
import { seedFixtures } from '../scripts/seed.ts';
import { startApi } from '../src/server.ts';
import { hashPassword,verifyPassword } from '../src/password.ts';
import { createHttpHandler } from '../src/http-handler.ts';
import { readLocalEnv } from '../scripts/local-env.ts';
import { stat, access, writeFile } from 'node:fs/promises';

async function freePort():Promise<number>{const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port;await new Promise<void>(resolve=>server.close(()=>resolve()));return port;}
test('password hashes have random salts and verify without plaintext storage',async()=>{
  const one=await hashPassword('Synthetic-test-password-42!'),two=await hashPassword('Synthetic-test-password-42!');
  assert.notEqual(one,two);assert.ok(await verifyPassword('Synthetic-test-password-42!',one));assert.equal(await verifyPassword('incorrect-password',one),false);assert.equal(await verifyPassword('anything','invalid'),false);
});

test('real PostgreSQL API, transactions, constraints and row policies',{timeout:120000},async t=>{
  const directory=await mkdtemp('/private/tmp/parkly-postgres-test-');
  const runtime=await localCluster(directory,await freePort());
  const accounts=await seedFixtures(runtime.settings.ownerUrl,runtime.root);
  const origin='http://127.0.0.1:5180';
  const api=await startApi({allowRegistration:true,databaseUrl:runtime.settings.apiUrl,publicOrigin:origin,port:0,expiryIntervalMs:60000});
  const owner=new pg.Client({connectionString:runtime.settings.ownerUrl});await owner.connect();
  async function request(path:string,method='GET',body?:unknown,cookie=''){
    const response=await fetch(`http://127.0.0.1:${api.port}/api/v1`+path,{method,headers:{Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    return{status:response.status,body:await response.json() as any,cookie:response.headers.get('set-cookie')?.split(';')[0]||''};
  }
  const password='Synthetic-test-password-42!';
  const first=await request('/auth/signup','POST',{email:'driver-one@example.test',password,name:'Driver One'});
  const second=await request('/auth/signup','POST',{email:'driver-two@example.test',password,name:'Driver Two'});
  assert.equal(first.status,201);assert.equal(second.status,201);
  const driver=first.cookie,other=second.cookie;
  const operator=(await request('/auth/login','POST',{email:accounts[1].email,password:accounts[1].password})).cookie;
  const east=(await request('/auth/login','POST',{email:accounts[2].email,password:accounts[2].password})).cookie;
  const admin=(await request('/auth/login','POST',{email:accounts[0].email,password:accounts[0].password})).cookie;
  const data=(await request('/compat/state','GET',undefined,operator)).body;
  const facility=data.lots.find((l:any)=>l.code==='p1');
  const start=Math.ceil((Date.now()+3*3600000)/3600000)*3600000,end=start+3600000;
  const list=(await request('/facilities/'+facility.id+'/spaces?start='+start+'&end='+end)).body.spaces;
  const space=list[0].id,spaceTwo=list[1].id;
  const holdBody=(spaceId=space,from=start,until=end,key=randomUUID())=>({spaceId,start:from,end:until,quotedPrice:400,idempotencyKey:key});
  let bookingId='';
  try{
    await t.test('course prototype disables registration by default and provisions fictional accounts in private .env',async()=>{
      const handle = createHttpHandler(api.db, { publicOrigin: origin });
      const response = await handle(new Request(origin+'/api/v1/auth/signup', { method:'POST', headers:{Origin:origin,'Content-Type':'application/json'}, body:JSON.stringify({email:'blocked@test.local',password,name:'Fictional blocked user'}) }));
      assert.equal(response.status,403); assert.equal((await response.json() as any).error.code,'REGISTRATION_DISABLED');
      const env = await readLocalEnv(runtime.root);
      assert.equal((await stat(runtime.root+'/.env')).mode & 0o777,0o600);
      assert.equal(env.DATABASE_URL,runtime.settings.apiUrl);
      await assert.rejects(access(runtime.root+'/runtime.json'));
      await assert.rejects(access(runtime.root+'/fixture-accounts.json'));
      for(const email of ['driver@test.local','operator@test.local']) {
        const account=accounts.find(a=>a.email===email)!; assert.ok(account);
        assert.ok(JSON.parse(env.PARKLY_FIXTURE_ACCOUNTS).some((a:any)=>a.email===email));
        const logged=await request('/auth/login','POST',{email,password:account.password}); assert.equal(logged.status,200);
        assert.equal((await request('/auth/me','GET',undefined,logged.cookie)).body.user.role,account.role);
      }
      const oldBrowser = { email: accounts[0].email, password: accounts[0].password, userId: accounts[0].id };
      await writeFile(runtime.root+'/browser-account.json',JSON.stringify(oldBrowser),{mode:0o600});
      const repeated=await seedFixtures(runtime.settings.ownerUrl,runtime.root);
      assert.deepEqual(repeated,accounts);
      assert.deepEqual(JSON.parse((await readLocalEnv(runtime.root)).PARKLY_LEGACY_BROWSER_ACCOUNT),oldBrowser);
      await assert.rejects(access(runtime.root+'/browser-account.json'));
    });
    await t.test('HTTP boundary rejects foreign origins, malformed and oversized input; owner credentials fail closed',async()=>{
      const send=async(body:string,originHeader=origin,contentType='application/json')=>{
        const response=await fetch(`http://127.0.0.1:${api.port}/api/v1/auth/login`,{method:'POST',headers:{Origin:originHeader,'Content-Type':contentType},body});
        return{status:response.status,body:await response.json() as any};
      };
      assert.equal((await send('{}','https://foreign.example')).status,403);
      assert.equal((await send('{}',origin,'text/plain')).status,415);
      assert.equal((await send('{')).status,400);
      const oversized=await send(JSON.stringify({padding:'x'.repeat(9000)}));
      assert.equal(oversized.status,413);assert.equal(oversized.body.error.code,'BODY_TOO_LARGE');assert.ok(oversized.body.requestId);
      await assert.rejects(startApi({databaseUrl:runtime.settings.ownerUrl,publicOrigin:origin,port:0}),/restricted NOBYPASSRLS role/);
    });
    await t.test('signup never accepts roles; credentials, private sessions and logout',async()=>{
      assert.equal((await request('/auth/signup','POST',{email:'attacker@example.test',password,name:'Attack',role:'admin'})).status,400);
      assert.equal((await request('/auth/login','POST',{email:'driver-one@example.test',password:'wrong-password-12'})).status,401);
      assert.equal((await request('/auth/me','GET',undefined,driver)).body.user.role,'driver');
      const record=(await owner.query('SELECT password_hash FROM auth.accounts WHERE user_id=$1',[first.body.userId])).rows[0];
      assert.match(record.password_hash,/^scrypt\$/);assert.ok(!record.password_hash.includes(password));
      const role=(await api.db.pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
      assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
      const logged=await request('/auth/login','POST',{email:'driver-two@example.test',password});
      assert.equal((await request('/auth/logout','POST',{},logged.cookie)).status,200);
      assert.equal((await request('/auth/me','GET',undefined,logged.cookie)).body.user,null);
    });
    await t.test('two independent users racing the same space: exactly one succeeds',async()=>{
      const results=await Promise.all([request('/holds','POST',holdBody(),driver),request('/holds','POST',holdBody(),other)]);
      assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
      const winner=results.findIndex(r=>r.status===200),cookie=winner===0?driver:other;
      const confirmed=await request('/holds/'+results[winner].body.id+'/confirm','POST',{},cookie);
      assert.equal(confirmed.status,200);bookingId=confirmed.body.id;
      assert.equal((await request('/holds/'+results[winner].body.id+'/confirm','POST',{},cookie)).body.id,bookingId);
      const loser=winner===0?other:driver;
      assert.equal((await request('/reservations/'+bookingId,'GET',undefined,loser)).status,404);
      assert.equal((await request('/reservations/'+bookingId+'/cancel','POST',{idempotencyKey:randomUUID()},loser)).status,404);
      const key=randomUUID();
      assert.equal((await request('/reservations/'+bookingId+'/cancel','POST',{idempotencyKey:key},cookie)).status,200);
      assert.equal((await request('/reservations/'+bookingId+'/cancel','POST',{idempotencyKey:key},cookie)).status,200);
      const history=(await request('/reservations/'+bookingId,'GET',undefined,cookie)).body.history;
      assert.deepEqual(history.map((h:any)=>h.to_status),['confirmed','cancelled']);
    });
    await t.test('RLS hides other users even in direct SQL; direct booking writes have no grant',async()=>{
      const identities=[first.body.userId,second.body.userId];
      const creator=(await owner.query('SELECT user_id FROM app.reservations WHERE id=$1',[bookingId])).rows[0].user_id;
      const outsider=identities.find(u=>u!==creator)!;
      await api.db.transaction(outsider,async c=>{
        assert.equal((await c.query('SELECT id FROM app.reservations WHERE id=$1',[bookingId])).rowCount,0);
        assert.equal((await c.query('SELECT id FROM app.profiles WHERE id=$1',[creator])).rowCount,0);
      });
      await assert.rejects(api.db.transaction(outsider,c=>c.query("UPDATE app.reservations SET status='confirmed' WHERE id=$1",[bookingId])),(e:any)=>e.code==='42501');
    });
    await t.test('operator cannot edit another organization; driver cannot manage inventory',async()=>{
      assert.equal((await request('/operator/facilities/'+facility.id+'/inventory','PATCH',{capacity:12,price:450},east)).status,403);
      assert.equal((await request('/operator/facilities/'+facility.id+'/inventory','PATCH',{capacity:12,price:450},driver)).status,403);
      assert.equal((await request('/operator/facilities/'+facility.id+'/inventory','PATCH',{capacity:12,price:400},operator)).status,200);
      await api.db.transaction(accounts[2].id,async c=>assert.equal((await c.query('SELECT id FROM app.operator_memberships WHERE user_id=$1',[accounts[1].id])).rowCount,0));
    });
    await t.test('non-overlapping and adjacent windows do not block each other; retry key is durable',async()=>{
      const key=randomUUID(),payload=holdBody(space,start,end,key);
      const repeats=await Promise.all(Array.from({length:6},()=>request('/holds','POST',payload,driver)));
      assert.ok(repeats.every(r=>r.status===200));assert.equal(new Set(repeats.map(r=>r.body.id)).size,1);
      const a=await request('/holds/'+repeats[0].body.id+'/confirm','POST',{},driver);assert.equal(a.status,200);
      const b=await request('/holds','POST',holdBody(space,end,end+3600000),other);assert.equal(b.status,200);
      const bReservation=await request('/holds/'+b.body.id+'/confirm','POST',{},other);assert.equal(bReservation.status,200);
      assert.equal((await request('/reservations/'+a.body.id+'/extend','POST',{end:end+3600000,idempotencyKey:randomUUID()},driver)).status,409);
      const unchanged=(await request('/reservations/'+a.body.id,'GET',undefined,driver)).body;
      assert.equal(unchanged.reservation.end,end);assert.equal(unchanged.reservation.total,400);assert.equal(unchanged.extensions.length,0);
      await request('/reservations/'+bReservation.body.id+'/cancel','POST',{idempotencyKey:randomUUID()},other);
      const extensionKey=randomUUID();
      const extended=await request('/reservations/'+a.body.id+'/extend','POST',{end:end+3600000,idempotencyKey:extensionKey},driver);assert.equal(extended.status,200);assert.equal(extended.body.total,800);
      assert.equal((await request('/reservations/'+a.body.id+'/extend','POST',{end:end+3600000,idempotencyKey:extensionKey},driver)).body.total,800);
      assert.equal((await request('/reservations/'+a.body.id,'GET',undefined,driver)).body.extensions.length,1);
      await request('/reservations/'+a.body.id+'/cancel','POST',{idempotencyKey:randomUUID()},driver);
    });
    await t.test('expired hold commits its release and cannot be confirmed',async()=>{
      const held=await request('/holds','POST',holdBody(space),driver);assert.equal(held.status,200);
      await owner.query("UPDATE app.holds SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[held.body.id]);
      assert.equal((await request('/holds/'+held.body.id+'/confirm','POST',{},driver)).status,410);
      assert.equal((await owner.query('SELECT state FROM app.holds WHERE id=$1',[held.body.id])).rows[0].state,'expired');
      const next=await request('/holds','POST',holdBody(space),other);assert.equal(next.status,200);
      await request('/holds/'+next.body.id+'/cancel','POST',{},other);
    });
    await t.test('confirmed reservation expiry has durable status history',async()=>{
      const held=await request('/holds','POST',holdBody(space),driver);
      const reserved=await request('/holds/'+held.body.id+'/confirm','POST',{},driver);
      await owner.query("UPDATE app.space_allocations SET starts_at=date_trunc('hour',clock_timestamp())-interval '2 hours',ends_at=date_trunc('hour',clock_timestamp())-interval '1 hour' WHERE id=(SELECT allocation_id FROM app.reservations WHERE id=$1)",[reserved.body.id]);
      await api.db.call(null,'SELECT app.expire_due() AS result');
      const record=(await request('/reservations/'+reserved.body.id,'GET',undefined,driver)).body;
      assert.equal(record.reservation.status,'expired');assert.ok(record.history.some((h:any)=>h.to_status==='expired'));
    });
    await t.test('maintenance shares the exclusion constraint and inventory cannot hide live holds',async()=>{
      const held=await request('/holds','POST',holdBody(space),driver);assert.equal(held.status,200);
      assert.equal((await request('/operator/spaces/'+space+'/blocks','POST',{start,end,reason:'Maintenance'},operator)).status,409);
      assert.equal((await request('/operator/facilities/'+facility.id+'/inventory','PATCH',{capacity:0,price:400},operator)).status,409);
      await request('/holds/'+held.body.id+'/cancel','POST',{},driver);
      const blocked=await request('/operator/spaces/'+space+'/blocks','POST',{start,end,reason:'Maintenance'},operator);assert.equal(blocked.status,200);
      assert.equal((await request('/holds','POST',holdBody(space),driver)).status,409);
      assert.equal((await request('/operator/blocks/'+blocked.body.id+'/cancel','POST',{},operator)).status,200);
    });
    await t.test('operator-recorded sessions are scoped; checkout and notifications persist',async()=>{
      const held=await request('/holds','POST',holdBody(spaceTwo),driver);assert.equal(held.status,200);
      const reserved=await request('/holds/'+held.body.id+'/confirm','POST',{},driver);
      await owner.query("UPDATE app.space_allocations SET starts_at=date_trunc('hour',clock_timestamp()),ends_at=date_trunc('hour',clock_timestamp())+interval '1 hour' WHERE id=(SELECT allocation_id FROM app.reservations WHERE id=$1)",[reserved.body.id]);
      assert.equal((await request('/reservations/'+reserved.body.id+'/check-in','POST',{},driver)).status,403);
      assert.equal((await request('/reservations/'+reserved.body.id+'/check-in','POST',{},east)).status,403);
      const session=await request('/reservations/'+reserved.body.id+'/check-in','POST',{},operator);assert.equal(session.status,200);
      assert.equal((await request('/sessions','GET',undefined,driver)).body.sessions.length,1);
      assert.equal((await request('/sessions','GET',undefined,other)).body.sessions.length,0);
      assert.equal((await request('/reservations/'+reserved.body.id+'/check-out','POST',{},operator)).status,200);
      assert.equal((await request('/reservations/'+reserved.body.id+'/check-out','POST',{},operator)).status,200);
      assert.equal((await request('/reservations/'+reserved.body.id,'GET',undefined,driver)).body.reservation.status,'completed');
      const ownReport=(await request('/reports','GET',undefined,driver)).body;
      assert.equal(ownReport.completed,1);assert.equal(ownReport.completedGmv,400);assert.equal(ownReport.estimatedCommission,40);
      assert.equal((await request('/reports','GET',undefined,east)).body.completed,0);
      assert.ok((await request('/notifications','GET',undefined,driver)).body.notifications.length>0);
      assert.equal((await request('/notifications/preferences','PATCH',{inApp:false,push:false},driver)).status,200);
      assert.equal((await request('/notifications/preferences','GET',undefined,driver)).body.preferences.in_app,false);
    });
    await t.test('admin-only membership and approvals; disabled user sessions are revoked',async()=>{
      assert.equal((await request('/admin/facilities/'+facility.id+'/approval','PATCH',{approved:false},driver)).status,403);
      assert.equal((await request('/admin/users/'+second.body.userId+'/active','PATCH',{active:false},admin)).status,200);
      assert.equal((await request('/auth/me','GET',undefined,other)).body.user,null);
      assert.equal((await request('/holds','POST',holdBody(),other)).status,401);
      const logs=(await request('/admin/audit','GET',undefined,admin)).body.audit;assert.ok(logs.length>0);
      assert.ok(!JSON.stringify(logs).includes(password));
    });
    await t.test('organization onboarding, floors, spaces and approval use persistent APIs',async()=>{
      const org=await request('/admin/operators','POST',{name:'Synthetic test organization'},admin);assert.equal(org.status,200);assert.ok(org.body.id);
      assert.equal((await request('/admin/operators/'+org.body.id+'/members','POST',{userId:first.body.userId,enabled:true},admin)).status,200);
      const created=await request('/operator/facilities','POST',{operatorId:org.body.id,name:'Synthetic facility',area:'Astana fixture area',address:'Fictional test address',lat:51.12,lng:71.42,type:'Covered',price:250,capacity:1},driver);
      assert.equal(created.status,200);const facilityId=created.body.id;
      const own=(await request('/compat/state','GET',undefined,driver)).body.lots.find((l:any)=>l.id===facilityId);assert.equal(own.approved,0);
      assert.ok(!(await request('/facilities')).body.facilities.some((l:any)=>l.id===facilityId));
      assert.equal((await request('/admin/facilities/'+facilityId+'/approval','PATCH',{approved:true},admin)).status,200);
      const floor=await request('/operator/facilities/'+facilityId+'/floors','POST',{name:'Level 2'},driver);assert.equal(floor.status,200);
      const added=await request('/operator/facilities/'+facilityId+'/spaces','POST',{floorId:floor.body.id,label:'L2-01'},driver);assert.equal(added.status,200);
      const structure=(await request('/operator/facilities/'+facilityId+'/structure','GET',undefined,driver)).body;
      assert.equal(structure.floors.length,2);assert.equal(structure.spaces.length,2);
      assert.equal((await request('/operator/facilities/'+facilityId+'/structure','GET',undefined,east)).status,403);
      assert.equal((await request('/facilities')).body.facilities.find((l:any)=>l.id===facilityId).occupancy_source,'not_available');
    });
    await t.test('floor drafts, publication, coordinates, unique labels and tenant isolation are persistent',async()=>{
      const path='/facilities/'+facility.id+'/layout?start='+start+'&end='+end;
      const publicBefore=(await request(path)).body;assert.equal(publicBefore.quote.total,400);assert.ok(publicBefore.serverNow);
      const floorId=publicBefore.floors[0].id,editor='/operator/floors/'+floorId;
      assert.equal((await request(editor+'/layout','GET',undefined,east)).status,403);
      const loaded=(await request(editor+'/layout','GET',undefined,operator)).body;
      const doc=structuredClone(loaded.document),original=doc.spaces[0];
      original.x+=20;original.rotation=90;
      const saved=await request(editor+'/layout','PATCH',{version:loaded.version,document:doc},operator);assert.equal(saved.status,200);
      assert.equal((await request(editor+'/layout','PATCH',{version:loaded.version,document:doc},operator)).status,409);
      assert.equal((await request(path)).body.floors[0].spaces.find((s:any)=>s.id===original.id).rotation,0);
      assert.equal((await request(editor+'/layout','GET',undefined,operator)).body.document.spaces[0].rotation,90);
      assert.equal((await request(editor+'/publish','POST',{version:saved.body.version},east)).status,403);
      assert.equal((await request(editor+'/publish','POST',{version:saved.body.version},operator)).status,200);
      assert.equal((await request(path)).body.floors[0].spaces.find((s:any)=>s.id===original.id).rotation,90);
      const added=await request(editor+'/spaces','POST',{label:'A-12'},operator);assert.equal(added.status,200);
      assert.ok(!(await request(path)).body.floors[0].spaces.some((s:any)=>s.id===added.body.id));
      assert.equal((await request('/holds','POST',holdBody(added.body.id),driver)).status,409);
      const fresh=(await request(editor+'/layout','GET',undefined,operator)).body;
      fresh.document.spaces.find((s:any)=>s.id===added.body.id).reservable=true;
      const duplicated=structuredClone(fresh.document);duplicated.spaces[1].label=duplicated.spaces[0].label;
      assert.equal((await request(editor+'/layout','PATCH',{version:fresh.version,document:duplicated},operator)).status,400);
      const outside=structuredClone(fresh.document);outside.spaces[0].x=10000;
      assert.equal((await request(editor+'/layout','PATCH',{version:fresh.version,document:outside},operator)).status,400);
      const updated=await request(editor+'/layout','PATCH',{version:fresh.version,document:fresh.document},operator);assert.equal(updated.status,200);
      assert.equal((await request(editor+'/publish','POST',{version:updated.body.version},operator)).status,200);
      assert.ok((await request(path)).body.floors[0].spaces.find((s:any)=>s.id===added.body.id).available);
      const held=await request('/holds','POST',holdBody(added.body.id),driver);assert.equal(held.status,200);
      assert.equal((await request(path)).body.floors[0].spaces.find((s:any)=>s.id===added.body.id).availability_status,'held');
      await request('/holds/'+held.body.id+'/cancel','POST',{},driver);
      const secondFloor=await request('/operator/facilities/'+facility.id+'/floors','POST',{name:'Floor 2'},operator);assert.equal(secondFloor.status,200);
      assert.equal((await request(path)).body.floors.length,2);
    });
    await t.test('500-space layouts exceed the ordinary body limit safely and keep coordinates in bounds',async()=>{
      const org=(await request('/operator/organizations','GET',undefined,operator)).body.operators[0];
      const facility=await request('/operator/facilities','POST',{operatorId:org.id,name:'Synthetic large layout',area:'Astana fixture',address:'Fictional',lat:51.12,lng:71.42,type:'Covered',price:200,capacity:500},operator);
      assert.equal(facility.status,200);
      const structure=(await request('/operator/facilities/'+facility.body.id+'/structure','GET',undefined,operator)).body;
      const route='/operator/floors/'+structure.floors[0].id+'/layout';
      const loaded=(await request(route,'GET',undefined,operator)).body;
      assert.equal(loaded.document.spaces.length,500);assert.ok(JSON.stringify(loaded.document).length>8192);
      assert.equal((await request(route,'PATCH',{version:loaded.version,document:loaded.document},operator)).status,200);
    });
    await t.test('the database exclusion constraint is effective even for privileged direct inserts',async()=>{
      const parameters=[space,facility.id,new Date(start).toISOString(),new Date(end).toISOString()];
      await owner.query("INSERT INTO app.space_allocations(space_id,facility_id,kind,starts_at,ends_at) VALUES($1,$2,'maintenance',$3,$4)",parameters);
      await assert.rejects(owner.query("INSERT INTO app.space_allocations(space_id,facility_id,kind,starts_at,ends_at) VALUES($1,$2,'maintenance',$3,$4)",parameters),(e:any)=>e.code==='23P01');
    });
  }finally{await owner.end();await api.close();await runtime.cluster.stop();}
});
