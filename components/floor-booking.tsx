'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,MapPin,CalendarDays,Heart,User,Map,Clock3,RefreshCw,X} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {apiCall} from '../lib/api-client';
import {nextAstanaHour} from '../lib/booking';
import type{Lot,User as Profile} from '../lib/contracts';
import type{MapFloor} from '../lib/floor-layout';
import ParkingPhoto from './parking-photo';
import FloorCanvas from './floor-canvas';

type Layout={facility:{name:string;address:string;area:string;rules:string;inventory_source:string};floors:MapFloor[];quote:{hourly:number;total:number;start:number;end:number};serverNow:number};
type Held={id:string;spaceId:string;expiresAt:string;total:number;serverNow:number;receivedAt:number};
const money=(n:number)=>new Intl.NumberFormat('en-KZ').format(n)+' ₸';
const wall=(ms:number)=>new Date(ms+5*3600000).toISOString().slice(0,16);
export default function FloorBooking({facility,user,onClose,onSignIn,onBooked,onNavigate}:{facility:Lot;user:Profile|null;onClose:()=>void;onSignIn:()=>void;onBooked:(booking:{id:string;reference:string})=>Promise<void>;onNavigate:(page:string,section?:string)=>void}){
  const[arrival,A]=useState(nextAstanaHour),[departure,D]=useState(()=>wall(new Date(nextAstanaHour()+'+05:00').getTime()+2*3600000)),[layout,L]=useState<Layout|null>(null),[floorId,F]=useState(''),[selected,S]=useState(''),[held,H]=useState<Held|null>(null),[error,E]=useState(''),[busy,B]=useState(false),[loading,Loading]=useState(true),[version,V]=useState(0),[tick,T]=useState(0);
  const key=useRef({fingerprint:'',key:''}),currentHold=useRef<Held|null>(null),sequence=useRef(0),mounted=useRef(true);
  const screen=useRef<HTMLElement>(null),close=useRef(onClose);close.current=onClose;
  const userId=user?.id;
  const start=new Date(arrival+'+05:00').getTime(),end=new Date(departure+'+05:00').getTime();
  const valid=Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=86400000&&start%3600000===0&&end%3600000===0;
  useEffect(()=>{mounted.current=true;const timer=setInterval(()=>T(n=>n+1),1000);return()=>{mounted.current=false;clearInterval(timer);};},[]);
  useEffect(()=>{const previousFocus=document.activeElement as HTMLElement|null;
    const controls=()=>Array.from(screen.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),summary,[tabindex="0"]:not([aria-disabled="true"])')||[]);
    controls()[0]?.focus();const onKey=(e:KeyboardEvent)=>{if(document.querySelector('.account-modal'))return;if(e.key==='Escape')close.current();if(e.key==='Tab'){const items=controls(),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',onKey);const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=previous;previousFocus?.focus();};},[]);
  useEffect(()=>{
    const run=++sequence.current;Loading(true);L(null);
    if(!valid){E('Choose whole-hour arrival and departure, with a duration of 1–24 hours.');Loading(false);return;}
    const receivedStart=performance.now();apiCall<Layout>('/facilities/'+facility.id+'/layout?'+new URLSearchParams({start:String(start),end:String(end)})).then(async data=>{
      const syncedNow=data.serverNow+(performance.now()-receivedStart)/2,syncedAt=performance.now();let own:Held|null=null;
      if(userId){const result=await apiCall<{holds:{id:string;space_id:string;facility_id:string;starts_at:string;ends_at:string;expires_at:string;total:number}[]}>('/holds');const h=result.holds.find(h=>h.facility_id===facility.id&&new Date(h.starts_at).getTime()===start&&new Date(h.ends_at).getTime()===end);if(h)own={id:h.id,spaceId:h.space_id,expiresAt:h.expires_at,total:h.total,serverNow:syncedNow+(performance.now()-syncedAt),receivedAt:performance.now()};}
      if(run!==sequence.current||!mounted.current)return;L(data);F(old=>data.floors.some(f=>f.id===old)?old:data.floors[0]?.id||'');
      if(own){currentHold.current=own;H(own);S(own.spaceId);F(data.floors.find(f=>f.spaces.some(s=>s.id===own!.spaceId))?.id||'');}
    }).catch(e=>{if(run===sequence.current&&mounted.current)E(e.message);}).finally(()=>{if(run===sequence.current&&mounted.current)Loading(false);});
    return()=>{sequence.current=run+1;};
  },[facility.id,start,end,userId,version,valid]);
  const remaining=held?Math.max(0,Math.ceil((new Date(held.expiresAt).getTime()-held.serverNow-(performance.now()-held.receivedAt))/1000)):0;
  useEffect(()=>{if(held&&remaining===0){currentHold.current=null;H(null);key.current={fingerprint:'',key:''};E('Your hold expired. The server will recheck this space before a new hold.');V(n=>n+1);}},[held,remaining,tick]);
  async function release(){const h=currentHold.current;currentHold.current=null;H(null);key.current={fingerprint:'',key:''};if(h)await apiCall('/holds/'+h.id+'/cancel','POST',{});}
  async function changeTime(next:string,kind:'arrival'|'departure'){try{await release();if(kind==='arrival')A(next);else D(next);S('');}catch(e){E((e as Error).message);}}
  function select(id:string){const s=layout?.floors.flatMap(f=>f.spaces).find(s=>s.id===id);if(!s?.available&&id!==held?.spaceId){E('This space is unavailable for your selected interval. Choose a green space.');return;}if(held&&id!==held.spaceId){E('Release your current hold before selecting another space.');return;}E('');S(id);}
  async function book(){
    if(!user){onSignIn();return;}if(!layout||!selected||busy)return;B(true);E('');
    try{
      if(held){if(remaining<=0)throw Error('Your hold expired. Refresh availability.');const confirmed=await apiCall<{id:string;reference:string}>('/holds/'+held.id+'/confirm','POST',{});currentHold.current=null;H(null);await onBooked(confirmed);return;}
      // A fresh authoritative response improves conflict feedback; the SQL hold
      // revalidates again under a lock and exclusion constraint before writing.
      const fresh=await apiCall<Layout>('/facilities/'+facility.id+'/layout?start='+start+'&end='+end);
      const space=fresh.floors.flatMap(f=>f.spaces).find(s=>s.id===selected);
      if(!space?.available){L(fresh);throw Error('Someone reserved or held this space. Select another green space.');}
      if(fresh.quote.hourly!==layout.quote.hourly){L(fresh);throw Error('The operator changed the price. Review the updated quote before holding.');}
      const fingerprint=[user.id,selected,start,end,fresh.quote.hourly].join(':');if(key.current.fingerprint!==fingerprint)key.current={fingerprint,key:crypto.randomUUID()};
      const sentAt=performance.now();const h=await apiCall<{id:string;state:string;expiresAt:string;total:number;serverNow:number}>('/holds','POST',{spaceId:selected,start,end,quotedPrice:fresh.quote.hourly,idempotencyKey:key.current.key});
      if(h.state!=='held'){key.current={fingerprint:'',key:''};throw Error('This previous hold is no longer active. Please try again.');}
      const value={...h,serverNow:h.serverNow+(performance.now()-sentAt)/2,spaceId:selected,receivedAt:performance.now()};currentHold.current=value;H(value);
    }catch(e){E((e as Error).message);}finally{if(mounted.current)B(false);}
  }
  const floor=layout?.floors.find(f=>f.id===floorId),space=layout?.floors.flatMap(f=>f.spaces).find(s=>s.id===selected);
  return <section ref={screen} className="floor-booking-screen" role="dialog" aria-modal="true" aria-labelledby="floor-screen-title">
    <div className="floor-screen-header"><button className="icon-btn" aria-label="Back to parking search" onClick={onClose}><ArrowLeft/></button><span className="brand"><span className="brand-mark">P<span>•</span></span>parkly<span className="brand-dot">.</span></span><button className="icon-btn" aria-label="Open account" onClick={onSignIn}><User/></button></div>
    <div className="floor-screen-content"><div className="facility-detail-header"><div className="floor-facility-title"><span className="eyebrow">SELECT YOUR PARKING SPACE</span><h1 id="floor-screen-title">{facility.name}</h1><p><MapPin size={15}/>{facility.area}</p><button className="text-link" onClick={()=>{onClose();onNavigate('help');}}>Parking policies & photo credits</button></div><ParkingPhoto lot={facility} variant="detail"/></div>
      <div className="floor-time-fields"><label>Arrival · Asia/Almaty<input type="datetime-local" step="3600" value={arrival} disabled={busy||!!held} onChange={e=>void changeTime(e.target.value,'arrival')}/></label><label>Departure · Asia/Almaty<input type="datetime-local" step="3600" value={departure} disabled={busy||!!held} onChange={e=>void changeTime(e.target.value,'departure')}/></label></div>
      {error&&<div role="alert" className="floor-error">{error}<button aria-label="Dismiss floor error" onClick={()=>E('')}><X size={17}/></button></div>}
      <div className="floor-workspace"><div className="floor-visual"><div className="floor-tabs" role="group" aria-label="Choose parking floor">{layout?.floors.map(f=><button key={f.id} aria-pressed={f.id===floorId} disabled={busy||!!held&&f.id!==floorId} onClick={()=>{F(f.id);if(!held)S('');}}>{f.name}</button>)}<button className="floor-refresh" aria-label="Refresh floor availability" disabled={loading||busy} onClick={()=>V(n=>n+1)}><RefreshCw size={16}/></button></div>
        {loading?<div className="floor-loading" role="status">Loading floors and selected-time availability…</div>:floor?<FloorCanvas floor={floor} selected={selected} held={held?.spaceId} onSelect={select}/>:<div className="floor-loading">No published floor is available for this facility.</div>}
        <div className="floor-legend"><span><i className="available"/>Available</span><span><i className="unavailable"/>Unavailable</span><span><i className="selected"/>Selected</span><span><i className="held"/>Temporary hold</span></div>
        {floor&&<details className="floor-list-alternative"><summary>Accessible list of spaces</summary><div>{floor.spaces.map(s=><button key={s.id} aria-pressed={selected===s.id} disabled={!s.available&&s.id!==held?.spaceId} onClick={()=>select(s.id)}>{s.label} · {s.id===held?.spaceId?'your hold':s.availability_status}</button>)}</div></details>}
      </div><aside className="floor-selection-card"><div className="row"><div><span className="eyebrow">{held?'YOUR SPACE IS HELD':'YOUR SELECTION'}</span><h2>{space?'Spot '+space.label:'Choose a green space'}</h2><p className="muted">{floor?.name||'Select a floor'}</p></div><strong className="floor-hourly">{layout?money(layout.quote.hourly):'—'}<small>/ hour</small></strong></div>
        <dl className="floor-price-lines"><div><dt>Duration</dt><dd>{valid?(end-start)/3600000:0} hours</dd></div><div><dt>Total price · KZT</dt><dd>{layout?money(held?.total??layout.quote.total):'—'}</dd></div></dl>
        {held&&<div className="floor-hold" role="timer" aria-label="Hold time remaining"><Clock3 size={20}/><div>Holding your selected space<strong>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong><small>Deadline from the server</small></div></div>}
        <button className="btn full floor-book" disabled={busy||loading||!space||!valid||!held&&!space.available||!!held&&remaining<=0} onClick={book}>{busy?'Saving…':held?'Book Now · confirm reservation':'Hold space & review'}</button>
        {held&&<button className="text-link" disabled={busy} onClick={async()=>{B(true);try{await release();V(n=>n+1);}catch(e){E((e as Error).message);}finally{B(false);}}}>Release hold and change selection</button>}
        <p className="fine-print">No payment is collected. A hold lasts five minutes. Current reservations do not provide physical parking access.</p><details className="booking-policy-details"><summary>Booking conditions</summary><p>Inventory is illustrative. Physical occupancy and parking access are not verified. Photographs show nearby areas, not a verified parking entrance.</p><p>{layout?.facility.rules}</p></details>
      </aside></div>
    </div><nav className="floor-bottom-nav" aria-label="Parking navigation">{([[Map,'Map','map',''],[CalendarDays,'Bookings','driver',''],[Heart,'Saved','driver','driver-favorites'],[User,'Profile','driver','driver-profile']] as [LucideIcon,string,string,string][]).map(([Icon,label,page,section])=><button key={label} className={label==='Map'?'active':''} onClick={()=>{onClose();onNavigate(page,section);}}><Icon size={21}/><span>{label}</span></button>)}</nav>
  </section>;
}
