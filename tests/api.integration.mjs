// Run only against a disposable local classroom database, with the dev server running.
import assert from 'node:assert/strict';
const base=process.env.PARKLY_TEST_URL||'http://127.0.0.1:5173';
async function request(body,cookie=''){const r=await fetch(base+'/api/demo',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
const login=async role=>{const r=await request({action:'login',role});assert.equal(r.status,200);return r.cookie};
const anonymous=await request();assert.equal(anonymous.body.lots.length,5);assert.equal(anonymous.body.users.length,0);
assert.equal((await request({action:'book',id:'p1'})).status,401);
const driver=await login('driver'),operator=await login('operator'),east=await login('operator-east'),admin=await login('admin');
const initial=(await request(null,operator)).body.lots.find(l=>l.id==='p1');
const start=Math.ceil((Date.now()+70*86400000)/3600000)*3600000,end=start+2*3600000;
const cleanup=[];
try{
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
assert.equal((await request(null,driver)).body.bookings.find(b=>b.id===cleanup[0]).status,'cancelled');
const next=await request({action:'book',id:'p1',start,end},driver);assert.equal(next.status,200);cleanup.push(next.body.id);
assert.equal((await request({action:'operatorCancel',id:next.body.id},operator)).status,200);
assert.equal((await request({action:'book',id:'p6',start,end},driver)).status,404);
assert.equal((await request({action:'approval',id:'p6',enabled:true},driver)).status,403);
assert.equal((await request({action:'book',id:'p1',start:Date.now()-7200000,end:Date.now()},driver)).status,400);
assert.equal((await request({action:'favorite',id:'p1',enabled:true},driver)).status,200);
assert.ok((await request(null,driver)).body.favorites.some(f=>f.lot_id==='p1'));
await request({action:'favorite',id:'p1',enabled:false},driver);
assert.equal((await request(null,admin)).body.users.length,4);
assert.equal((await request({action:'user',id:'admin',enabled:false},admin)).status,400);
console.log('PASS: persistence, booking price, cancellation/rebooking,8-way overbooking race, inventory floor, role ownership, approval gates, favorites and validation.');
}finally{for(const id of cleanup)await request({action:'cancel',id},driver);await request({action:'inventory',id:'p1',capacity:initial.capacity,price:initial.price},operator)}
