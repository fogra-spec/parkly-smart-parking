import type {AppData,Booking,ParklyRepository} from '../models.ts';
import {validateTime} from '../domain.ts';
export function validateLocalUrl(raw:string){const u=new URL(raw);const h=u.hostname.replace(/^\[|\]$/g,''),parts=h.split('.');const ipv4=parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&+p<=255);const local=h==='localhost'||h==='::1'||ipv4&&(+parts[0]===127||+parts[0]===10||+parts[0]===192&&+parts[1]===168||+parts[0]===172&&+parts[1]>=16&&+parts[1]<=31);if(!local||!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Only a local development server URL is allowed. Production is disabled.');return u.origin;}
type Fetcher=typeof fetch;
export function createLocalApiRepository(rawUrl:string,fetcher:Fetcher=fetch):ParklyRepository{
  const base=validateLocalUrl(rawUrl);
  async function request(path:string,body?:object){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const r=await fetcher(base+path,{method:body?'POST':'GET',credentials:'include',redirect:'error',signal:controller.signal,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const d=await r.json() as Record<string,any>;if(!r.ok)throw Error(typeof d.error==='string'?d.error:'Local demo server request failed.');return d;}catch(e){if(e instanceof Error&&e.name==='AbortError')throw Error('Local server timed out. Check its address and connection.');throw e;}finally{clearTimeout(timer)}}
  async function load():Promise<AppData>{const d=await request('/api/demo');if(!Array.isArray(d.lots)||!Array.isArray(d.bookings))throw Error('Local server returned an invalid demo response.');if(d.user&&d.user.role!=='driver')throw Error('The local server session is not a driver. Sign in to the shared driver demo.');return {user:d.user?{...d.user,email:'shared-driver@parkly.demo'}:null,lots:d.lots,bookings:d.bookings};}
  return {mode:'local-api',load,
    async signIn(){await request('/api/demo',{action:'login',role:'driver'});return load();},
    async signUp(){throw Error('The website has no sign-up API. Use mock mode to create a local demo profile.');},
    async signOut(){await request('/api/demo',{action:'logout'});},
    async availability(id,start,end){const d=await request('/api/availability?'+new URLSearchParams({id,start:String(start),end:String(end)}));if(typeof d.available!=='number')throw Error('Invalid availability response.');return d.available;},
    async book(r){const end=validateTime(r.start,r.hours);const before=await load(),lot=before.lots.find(l=>l.id===r.lotId);if(!lot||lot.price!==r.quotedPrice)throw Error('Price or listing changed. Review the details.');const d=await request('/api/demo',{action:'book',id:r.lotId,start:r.start,end});const after=await load(),b=after.bookings.find(b=>b.id===d.id);if(!b)throw Error('Confirmation could not be read. Check My Bookings before trying again.');return b as Booking;},
    async cancel(id){await request('/api/demo',{action:'cancel',id});},
    async updateProfile(name){await request('/api/demo',{action:'profile',name});}
  };
}
