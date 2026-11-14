// Pre-provisioned fictional driver against the localhost website HTTP bridge.
// Records remain as clearly named QA records; no existing account is modified.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const base=process.env.PARKLY_TEST_URL||'http://127.0.0.1:5173';
const origin=new URL(base);
if(origin.origin!==base||origin.protocol!=='http:'||!['127.0.0.1','localhost'].includes(origin.hostname))throw Error('Use a loopback demo only.');
let cookie='',checks=0,bookingId='';
const env=parseEnv(await readFile(new URL('../backend/.local/.env',import.meta.url),'utf8'));
const fixtures=JSON.parse(env.PARKLY_FIXTURE_ACCOUNTS);
const {email,password}=fixtures.find(account=>account.email==='driver@test.local');
async function request(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
 const data=await response.json();assert.ok(response.ok,`${path}: ${response.status} ${JSON.stringify(data.error||{})}`);
 const next=response.headers.get('set-cookie');if(next)cookie=next.split(';')[0];checks++;return data;
}
try{
 const guest=await request('/api/demo');assert.equal(guest.auth.mode,'password');assert.equal(guest.user,null);
 const blocked=await fetch(base+'/api/v1/auth/signup',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'blocked@test.local',password,name:'Fictional blocked user'})});assert.equal(blocked.status,403);
 await request('/api/v1/auth/login','POST',{email,password});
 const state=await request('/api/demo');assert.equal(state.user.role,'driver');assert.ok(state.summary);
 const facility=state.lots.find(l=>l.approved),start=Math.ceil((Date.now()+48*3600000)/3600000)*3600000,end=start+3600000;
 const layout=await request(`/api/v1/facilities/${facility.id}/layout?start=${start}&end=${end}`);
 const space=layout.floors.flatMap(f=>f.spaces).find(s=>s.available);assert.ok(space);
 const held=await request('/api/v1/holds','POST',{spaceId:space.id,start,end,quotedPrice:layout.quote.hourly,idempotencyKey:randomUUID()});assert.equal(held.total,layout.quote.total);
 const confirmed=await request('/api/v1/holds/'+held.id+'/confirm','POST',{});bookingId=confirmed.id;assert.ok(confirmed.reference);
 const options=await request('/api/v1/reservations/'+bookingId+'/extension-options'),extension=options.options.find(o=>o.available);assert.ok(extension);
 await request('/api/v1/reservations/'+bookingId+'/extend','POST',{end:extension.end,quotedTotal:extension.newTotal,idempotencyKey:randomUUID()});
 await request('/api/demo','POST',{action:'favorite',id:facility.id,enabled:true});
 await request('/api/demo','POST',{action:'profile',name:'Synthetic Updated QA'});
 const support=await request('/api/v1/support','POST',{reservationId:bookingId,subject:'Synthetic integration verification',message:'Automated QA case. No staff action or real parking is required.',idempotencyKey:randomUUID()});
 assert.equal((await request('/api/v1/support/'+support.id)).messages.length,1);
 const cancellation={idempotencyKey:randomUUID()};await request('/api/v1/reservations/'+bookingId+'/cancel','POST',cancellation);await request('/api/v1/reservations/'+bookingId+'/cancel','POST',cancellation);
 const notifications=await request('/api/v1/notifications'),event=notifications.notifications.find(n=>n.reservation_id===bookingId);assert.ok(event);await request('/api/v1/notifications/'+event.id+'/read','POST',{});
 await request('/api/v1/auth/logout','POST',{});cookie='';await request('/api/v1/auth/login','POST',{email,password});
 const persisted=await request('/api/demo');assert.equal(persisted.user.name,'Synthetic Updated QA');assert.ok(persisted.favorites.some(f=>f.lot_id===facility.id));
 const record=await request('/api/v1/reservations/'+bookingId);assert.equal(record.reservation.status,'cancelled');assert.equal(record.reservation.total,extension.newTotal);assert.equal(record.extensions.length,1);
 assert.ok((await request('/api/v1/reservations?scope=own&bucket=past')).total>=1);
 console.log(`PASS: ${checks} website/API bridge steps: restricted login, floor selection, hold, confirmation, extension, favorites, profile, support, cancellation replay, notifications and persistence after login.`);
}finally{
 if(cookie){if(bookingId)await request('/api/v1/reservations/'+bookingId+'/cancel','POST',{idempotencyKey:randomUUID()}).catch(()=>{});await request('/api/v1/auth/logout','POST',{}).catch(()=>{});}
}
