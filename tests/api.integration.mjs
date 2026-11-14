// Run only against a disposable local classroom database, with the dev server running.
import assert from 'node:assert/strict';
const base=process.env.PARKLY_TEST_URL;
if(!base)throw Error('Set PARKLY_TEST_URL to an isolated local preview with a disposable database.');
const target=new URL(base);
if(target.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Integration mutations are restricted to a loopback HTTP server.');
async function request(body,cookie=''){const r=await fetch(base+'/api/demo',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
const login=async role=>{const r=await request({action:'login',role});assert.equal(r.status,200);return r.cookie};
const start=Math.ceil((Date.now()+70*86400000)/3600000)*3600000,end=start+2*3600000;
const anonymous=await request();assert.equal(anonymous.body.lots.length,5);assert.equal(anonymous.body.users.length,0);
assert.equal((await request({action:'book',id:'p1',start,end})).status,401);
const driver=await login('driver'),operator=await login('operator'),east=await login('operator-east'),admin=await login('admin');
const initial=(await request(null,operator)).body.lots.find(l=>l.id==='p1');
const cleanup=[];
try{
assert.equal((await fetch(base+'/api/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'})).status,400);
assert.equal((await fetch(base+'/api/demo',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
assert.equal((await fetch(base+'/api/demo',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'})).status,403);
assert.equal((await request({action:'approval',id:'p6'},admin)).status,400);
assert.equal((await request({action:'user',id:'missing',enabled:false},admin)).status,404);
assert.equal((await request({action:'inventory',id:'p1',capacity:1,price:400},driver)).status,403);
assert.equal((await request({action:'inventory',id:'p3',capacity:1,price:400},operator)).status,403);
assert.equal((await request({action:'inventory',id:'p1',capacity:-1,price:400},operator)).status,400);
assert.equal((await request({action:'inventory',id:'p1',capacity:1,price:400},operator)).status,200);
const parallel=await Promise.all(Array.from({length:8},()=>request({action:'book',id:'p1',start,end},driver)));
const accepted=parallel.filter(r=>r.status===200);assert.equal(accepted.length,1);assert.equal(parallel.filter(r=>r.status===409).length,7);cleanup.push(accepted[0].body.id);assert.equal(accepted[0].body.total,800);
assert.equal((await request(null,driver)).body.bookings.find(b=>b.id===cleanup[0]).status,'confirmed');
assert.equal((await request({action:'inventory',id:'p1',capacity:0,price:400},operator)).status,409);
assert.equal((await request({action:'cancel',id:cleanup[0]},east)).status,403);
assert.equal((await request({action:'complete',id:cleanup[0]},operator)).status,400);
assert.equal((await request({action:'cancel',id:cleanup[0]},driver)).status,200);
assert.equal((await request({action:'cancel',id:cleanup[0]},driver)).status,200);
assert.equal((await request({action:'operatorCancel',id:cleanup[0]},operator)).status,409);
assert.equal((await request(null,driver)).body.bookings.find(b=>b.id===cleanup[0]).status,'cancelled');
const next=await request({action:'book',id:'p1',start,end},driver);assert.equal(next.status,200);cleanup.push(next.body.id);
assert.equal((await request({action:'operatorCancel',id:next.body.id},operator)).status,200);
// Back-to-back intervals must leave room for one long booking at capacity two.
assert.equal((await request({action:'inventory',id:'p1',capacity:2,price:400},operator)).status,200);
for(const [a,b] of [[start,end],[end,end+2*3600000]]){
  const r=await request({action:'book',id:'p1',start:a,end:b},driver);assert.equal(r.status,200);cleanup.push(r.body.id);
}
const availability=await fetch(base+'/api/availability?'+new URLSearchParams({id:'p1',start:String(start),end:String(end+2*3600000)}));
assert.equal(availability.status,200);assert.equal((await availability.json()).available,1);
const idempotencyKey=crypto.randomUUID();
const retries=await Promise.all(Array.from({length:8},()=>request({action:'book',id:'p1',start,end:end+2*3600000,quotedPrice:400,idempotencyKey},driver)));
assert.ok(retries.every(r=>r.status===200));assert.equal(new Set(retries.map(r=>r.body.id)).size,1);cleanup.push(retries[0].body.id);
assert.equal((await request({action:'book',id:'p2',start,end,quotedPrice:400,idempotencyKey},driver)).status,409);
assert.equal((await request({action:'book',id:'p1',start,end:end+25*3600000},driver)).status,400);
await request({action:'cancel',id:retries[0].body.id},driver);
assert.equal((await request({action:'book',id:'p1',start,end,quotedPrice:1},driver)).status,409);
assert.equal((await request({action:'inventory',id:'p1',capacity:2,price:500},operator)).status,200);
assert.equal((await request(null,driver)).body.bookings.find(b=>b.id===retries[0].body.id).total,1600);
assert.equal((await request({action:'book',id:'p6',start,end},driver)).status,404);
assert.equal((await request({action:'approval',id:'p6',enabled:true},driver)).status,403);
assert.equal((await request({action:'book',id:'p1',start:Date.now()-7200000,end:Date.now()},driver)).status,400);
assert.equal((await request({action:'favorite',id:'p1',enabled:true},driver)).status,200);
assert.ok((await request(null,driver)).body.favorites.some(f=>f.lot_id==='p1'));
await request({action:'favorite',id:'p1',enabled:false},driver);
assert.equal((await request(null,admin)).body.users.length,4);
assert.equal((await request({action:'user',id:'admin',enabled:false},admin)).status,400);
assert.match((await fetch(base+'/api/demo')).headers.get('cache-control'),/no-store/);
console.log('PASS: persistence, price snapshots, cancel/replay, 8-way final-slot race, 8-way same-key retry, exact peak availability, inventory floor, ownership, approval gates, favorites, CSRF, JSON validation and safe error responses.');
}finally{for(const id of cleanup)await request({action:'cancel',id},driver);await request({action:'inventory',id:'p1',capacity:initial.capacity,price:initial.price},operator)}
