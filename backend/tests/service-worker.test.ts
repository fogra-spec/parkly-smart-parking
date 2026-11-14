import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';

async function harness(){
  const handlers:Record<string,(event:any)=>void>={},shown:any[]=[],opened:string[]=[],messages:any[]=[];
  let responseStatus=200,failReceipt=false,failDisplay=false;
  const booking=randomUUID(),device=randomUUID(),delivery=randomUUID();
  const context=vm.createContext({indexedDB:new IDBFactory(),URL,Date,Response,console,
    self:{location:{origin:'https://parkly.test'},addEventListener:(name:string,handler:(event:any)=>void)=>handlers[name]=handler,
      registration:{showNotification:async(title:string,options:unknown)=>{if(failDisplay)throw Error('Permission revoked');shown.push({title,options});},getNotifications:async()=>[]},
      clients:{matchAll:async()=>[],openWindow:async(url:string)=>{opened.push(url);}},skipWaiting:async()=>{}},
    fetch:async(_url:string,init?:RequestInit)=>{if(init?.method==='POST'){if(failReceipt)throw Error('Network error');return Response.json({ok:true});}return Response.json({bookingId:booking,body:'Only 5 minutes remain.'},{status:responseStatus});},
  });
  vm.runInContext(await readFile(new URL('../../public/sw.js',import.meta.url),'utf8'),context);
  async function dispatch(name:string,extra:any){let pending:Promise<unknown>|undefined;handlers[name]({...extra,waitUntil:(p:Promise<unknown>)=>pending=p});await pending;}
  await dispatch('message',{data:{type:'PARKLY_PUSH_BIND',deviceId:device},ports:[{postMessage:(v:unknown)=>messages.push(v)}]});
  const push=(id=delivery,deviceId=device)=>dispatch('push',{data:{json:()=>({id,deviceId,token:'a'.repeat(64)})}});
  return{dispatch,push,shown,opened,messages,booking,device,delivery,setStatus:(n:number)=>responseStatus=n,setReceiptFailure:(v:boolean)=>failReceipt=v,setDisplayFailure:(v:boolean)=>failDisplay=v};
}
test('service worker persistently deduplicates concurrent/retried pushes with no page open',async()=>{
  const h=await harness();assert.equal(h.messages[0].ok,true);await Promise.all([h.push(),h.push()]);await h.push();assert.equal(h.shown.length,1);
  assert.equal(h.shown[0].options.body,'Only 5 minutes remain.');assert.equal(h.shown[0].options.tag,'parkly-booking-'+h.booking);
});
test('acknowledgement loss does not repeat an already requested browser display',async()=>{const h=await harness();h.setReceiptFailure(true);await h.push();await h.push();assert.equal(h.shown.length,1);});
test('revoked device bindings, expired reminders and invalid payloads never display',async()=>{
  const h=await harness();await h.push(randomUUID(),randomUUID());h.setStatus(410);await h.push();assert.equal(h.shown.length,0);
  await h.dispatch('message',{data:{type:'PARKLY_PUSH_CLEAR'},ports:[]});h.setStatus(200);await h.push();assert.equal(h.shown.length,0);
  await h.dispatch('push',{data:{json:()=>({id:'bad',token:'bad'})}});assert.equal(h.shown.length,0);
});
test('a browser display rejection is not recorded as successful and can be retried',async()=>{const h=await harness();h.setDisplayFailure(true);await h.push();assert.equal(h.shown.length,0);h.setDisplayFailure(false);await h.push();assert.equal(h.shown.length,1);});
test('notification click opens only the exact protected same-origin booking route',async()=>{
  const h=await harness();await h.dispatch('notificationclick',{notification:{close:()=>{},data:{bookingId:h.booking,url:'https://untrusted.example'}}});assert.equal(h.opened[0],'https://parkly.test/#/driver?booking='+h.booking);
  await h.dispatch('notificationclick',{notification:{close:()=>{},data:{bookingId:'../../other'}}});assert.equal(h.opened.length,1);
});
