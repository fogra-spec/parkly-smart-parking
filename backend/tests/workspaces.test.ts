import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { localCluster } from '../scripts/cluster.ts';
import { seedFixtures } from '../scripts/seed.ts';
import { startApi } from '../src/server.ts';
async function freePort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as {port:number}).port;await new Promise<void>(r=>s.close(()=>r()));return p;}
test('complete workspaces use persistent scoped records',{timeout:120000},async t=>{
 const runtime=await localCluster(await mkdtemp('/private/tmp/parkly-workspaces-'),await freePort());
 const accounts=await seedFixtures(runtime.settings.ownerUrl,runtime.root);
 const api=await startApi({allowRegistration:true,databaseUrl:runtime.settings.apiUrl,publicOrigin:'http://127.0.0.1:5180',port:0});
 const owner=new pg.Client({connectionString:runtime.settings.ownerUrl});await owner.connect();
 async function req(path:string,method='GET',body?:unknown,cookie=''){
  const r=await fetch(`http://127.0.0.1:${api.port}/api/v1${path}`,{method,headers:{Origin:'http://127.0.0.1:5180',Cookie:cookie,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return{status:r.status,body:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]||''};
 }
 const password='Synthetic-workspace-password-42!';
 try{
  const one=await req('/auth/signup','POST',{email:'workspace-one@example.test',password,name:'Workspace Driver'}),two=await req('/auth/signup','POST',{email:'workspace-two@example.test',password,name:'Other Driver'});
  const driver=one.cookie,other=two.cookie;
  // Auth input is strict; send only email/password for fixture accounts.
  const login=async(i:number)=>(await req('/auth/login','POST',{email:accounts[i].email,password:accounts[i].password})).cookie;
  const staff=await login(0),operator=await login(1),east=await login(2);
  const facilities=(await req('/compat/state','GET',undefined,operator)).body.lots,facility=facilities.find((f:any)=>f.code==='p1');
  await t.test('support create/retry, ownership, admin reply, resolution and reopening',async()=>{
   const body={subject:'Reservation question',message:'Please explain the reservation cancellation policy.',idempotencyKey:randomUUID()};
   const opened=await req('/support','POST',body,driver);assert.equal(opened.status,200);const id=opened.body.id;
   assert.equal((await req('/support','POST',body,driver)).body.id,id);
   assert.equal((await req('/support','POST',{...body,message:'Changed details'},driver)).status,409);
   assert.equal((await req('/support/'+id,'GET',undefined,other)).status,404);
   assert.equal((await req('/support/'+id,'GET',undefined,operator)).status,404);
   assert.equal((await req('/support','GET',undefined,other)).body.tickets.length,0);
   assert.equal((await req('/support/'+id+'/messages','POST',{message:'Set resolved',status:'resolved',idempotencyKey:randomUUID()},driver)).status,403);
   const reply={message:'You may cancel before arrival. This case is now resolved.',status:'resolved',idempotencyKey:randomUUID()};
   assert.equal((await req('/support/'+id+'/messages','POST',reply,staff)).status,200);
   assert.equal((await req('/support/'+id+'/messages','POST',reply,staff)).status,200);
   const thread=(await req('/support/'+id,'GET',undefined,driver)).body;
   assert.equal(thread.ticket.status,'resolved');assert.equal(thread.messages.length,2);assert.equal(thread.messages[1].staff,true);
   assert.equal((await req('/support/'+id+'/messages','POST',{message:'One additional question.',idempotencyKey:randomUUID()},driver)).status,200);
   assert.equal((await req('/support/'+id,'GET',undefined,staff)).body.ticket.status,'open');
   await assert.rejects(api.db.transaction(one.body.userId,c=>c.query("INSERT INTO app.support_tickets(user_id,subject,request_key) VALUES(app.uid(),'Forbidden',$1)",[randomUUID()])),(e:{code:string})=>e.code==='42501');
  });
  await t.test('operator approval is admin-only, atomic and safe under concurrent retries',async()=>{
   const body={name:'Fictional Applicant Parking',description:'Test organization requests access to manage fictional allocated inventory.',idempotencyKey:randomUUID()};
   const a=await req('/operator-applications','POST',body,driver);assert.equal(a.status,200);
   assert.equal((await req('/operator-applications','POST',body,driver)).body.id,a.body.id);
   assert.equal((await req('/operator-applications','POST',{...body,idempotencyKey:randomUUID()},driver)).status,409);
   assert.equal((await req('/operator-applications','GET',undefined,other)).body.applications.length,0);
   const review={approved:true,note:'Approved only for the synthetic test organization.'};
   assert.equal((await req('/admin/operator-applications/'+a.body.id,'PATCH',review,other)).status,403);
   const results=await Promise.all([req('/admin/operator-applications/'+a.body.id,'PATCH',review,staff),req('/admin/operator-applications/'+a.body.id,'PATCH',review,staff)]);
   assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(results[0].body.operatorId,results[1].body.operatorId);
   assert.equal((await req('/auth/me','GET',undefined,driver)).body.user.role,'operator');
   assert.equal((await req('/admin/operator-applications/'+a.body.id,'PATCH',{approved:false,note:'Opposite decision'},staff)).status,409);
   assert.equal((await req('/operator/organizations','GET',undefined,driver)).body.operators.length,1);
  });
  await t.test('listing changes require assigned organization; values persist',async()=>{
   const details={name:facility.name,area:facility.area,address:'Fictional revised Astana address',rules:'Fictional operator rules, no verified occupancy.',hours:'24 hours (operator entered)'};
   assert.equal((await req('/operator/facilities/'+facility.id+'/details','PATCH',details,east)).status,403);
   assert.equal((await req('/operator/facilities/'+facility.id+'/details','PATCH',details,operator)).status,200);
   assert.equal((await req('/facilities','GET')).body.facilities.find((f:any)=>f.id===facility.id).address,details.address);
  });
  await t.test('pagination and aggregate totals are complete beyond 200 records',async()=>{
   const space=(await owner.query('SELECT id FROM app.spaces WHERE facility_id=$1 LIMIT 1',[facility.id])).rows[0].id;
   await owner.query(`WITH allocations AS (
     INSERT INTO app.space_allocations(space_id,facility_id,user_id,kind,starts_at,ends_at,released_at)
     SELECT $1,$2,$3,'reservation',date_trunc('hour',clock_timestamp())-(n+2)*interval '1 hour',date_trunc('hour',clock_timestamp())-(n+1)*interval '1 hour',clock_timestamp() FROM generate_series(1,205) n RETURNING id
    ), holds AS (
     INSERT INTO app.holds(user_id,allocation_id,request_key,hourly_kzt,total_kzt,state,expires_at)
     SELECT $3,id,gen_random_uuid(),400,400,'confirmed',clock_timestamp()+interval '5 minutes' FROM allocations RETURNING id,allocation_id
    ) INSERT INTO app.reservations(user_id,facility_id,hold_id,allocation_id,hourly_kzt,original_total_kzt,total_kzt,status)
      SELECT $3,$2,id,allocation_id,400,400,400,'completed' FROM holds`,[space,facility.id,two.body.userId]);
   const first=(await req('/reservations?scope=own&limit=20','GET',undefined,other)).body,next=(await req('/reservations?scope=own&limit=20&offset=20','GET',undefined,other)).body;
   assert.equal(first.total,205);assert.equal(first.reservations.length,20);assert.equal(next.reservations.length,20);
   assert.ok(!first.reservations.some((a:any)=>next.reservations.some((b:any)=>a.id===b.id)));
   const summary=(await req('/dashboard','GET',undefined,other)).body;assert.equal(summary.bookings.total,205);assert.equal(summary.bookings.completedValue,82000);
   assert.equal((await req('/reports','GET',undefined,operator)).body.completedGmv,82000);
   assert.equal((await req('/reports','GET',undefined,east)).body.completedGmv,0);
   const report=(await req('/reports','GET',undefined,operator)).body;assert.equal(report.estimatedCommission,8200);assert.equal(report.estimatedOperatorAllocation,73800);assert.equal(report.costs,'not_recorded');
   assert.equal((await req('/reports?start=20&end=10','GET',undefined,operator)).status,400);
   assert.equal((await req('/reservations?limit=999','GET',undefined,other)).status,400);
   assert.equal((await req('/reservations?scope=own','GET',undefined,driver)).body.total,0);
   const forbidden=await req('/support','POST',{reservationId:first.reservations[0].id,subject:'Other user',message:'Should never be accepted',idempotencyKey:randomUUID()},driver);assert.equal(forbidden.status,404);
  });
  await t.test('admin operations, audit/users paging and private notification read actions',async()=>{
   for(const path of ['/admin/system','/admin/audit','/admin/users']){assert.equal((await req(path,'GET',undefined,other)).status,403);assert.equal((await req(path)).status,401);assert.equal((await req(path,'GET',undefined,staff)).status,200);}
   const logs=(await req('/admin/audit?limit=5','GET',undefined,staff)).body;assert.equal(logs.audit.length,5);assert.ok(logs.total>205);
   const notifications=(await req('/notifications?limit=20','GET',undefined,other)).body;assert.equal(notifications.total,205);assert.equal(notifications.notifications.length,20);
   const id=notifications.notifications[0].id;assert.equal((await req('/notifications/'+id+'/read','POST',{},other)).status,200);
   assert.equal((await req('/notifications/'+id+'/read','POST',{},driver)).status,404);
   assert.ok((await req('/notifications?limit=20','GET',undefined,other)).body.notifications.find((n:any)=>n.id===id).read_at);
  });
  await t.test('password settings require the current password and revoke all sessions',async()=>{
   const secondLogin=await req('/auth/login','POST',{email:'workspace-two@example.test',password});
   assert.equal((await req('/auth/password','POST',{currentPassword:'Incorrect-password-42!',newPassword:'New-synthetic-password-42!'},other)).status,401);
   assert.equal((await req('/auth/password','POST',{currentPassword:password,newPassword:'New-synthetic-password-42!'},other)).status,200);
   assert.equal((await req('/auth/me','GET',undefined,secondLogin.cookie)).body.user,null);
   assert.equal((await req('/auth/me','GET',undefined,other)).body.user,null);
   assert.equal((await req('/auth/login','POST',{email:'workspace-two@example.test',password})).status,401);
   assert.equal((await req('/auth/login','POST',{email:'workspace-two@example.test',password:'New-synthetic-password-42!'})).status,200);
  });

 }finally{await owner.end();await api.close();await runtime.cluster.stop();}
});
