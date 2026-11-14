'use client';
import {useEffect,useRef,useState} from 'react';
import {Clock3,MapPin} from 'lucide-react';
import {apiCall} from '../lib/api-client';
type SessionBooking={id:string;reference:string;status:string;name:string;address:string;space_label:string;floor_name:string;start:number;end:number;session_state:string|null};
export default function ParkingSession({onExtend,revision}:{onExtend:(id:string)=>void;revision:string}){
  const[booking,B]=useState<SessionBooking|null>(null),[error,E]=useState(''),[loading,L]=useState(true),[,T]=useState(0),sync=useRef({now:Date.now(),at:0});
  async function load(){const query=new URLSearchParams(window.location.hash.split('?')[1]||''),id=query.get('booking');L(true);E('');try{const sent=performance.now(),d=await apiCall<{booking:SessionBooking|null;serverNow:number}>('/parking-session'+(id?'?booking='+encodeURIComponent(id):''));B(d.booking);sync.current={now:d.serverNow+(performance.now()-sent)/2,at:performance.now()};T(n=>n+1);}catch(e){B(null);E((e as Error).message);}finally{L(false);}}
  useEffect(()=>{void load();const interval=setInterval(()=>void load(),30000),count=setInterval(()=>T(n=>n+1),1000);const focus=()=>void load();window.addEventListener('hashchange',focus);window.addEventListener('focus',focus);return()=>{clearInterval(interval);clearInterval(count);window.removeEventListener('hashchange',focus);window.removeEventListener('focus',focus);};},[revision]);
  const now=sync.current.now+Math.max(0,performance.now()-sync.current.at),remaining=booking?.status==='confirmed'?Math.max(0,Math.ceil((booking.end-now)/1000)):0;
  const local=(n:number)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Almaty',dateStyle:'medium',timeStyle:'short'}).format(n);
  return <section className="panel current-parking" aria-label="Current parking reservation"><div className="row"><h2><Clock3 size={22}/>Your parking session</h2><button className="small-btn" onClick={()=>void load()}>Refresh session</button></div>
    {error?<p role="alert" className="inline-error">{error}</p>:!booking?<p className="muted">{loading?'Loading your reservation…':'No reservation to show. Choose a parking space to get started.'}</p>:<><div className="current-parking-head"><div><span className="eyebrow">{booking.status==='confirmed'&&now>=booking.end?'RESERVATION TIME ENDED':booking.status.replaceAll('_',' ').toUpperCase()}</span><h3>{booking.name}</h3><p className="muted"><MapPin size={14}/>{/^Fictional location/i.test(booking.address)?'See facility map for area details':booking.address}</p><p><strong>{booking.floor_name} · Spot {booking.space_label}</strong></p><small className="muted">{booking.reference}</small></div><div className="session-countdown"><span>{booking.status.includes('cancelled')?'Reservation cancelled':booking.status!=='confirmed'?'Reservation closed':now<booking.start?'Time reserved until':remaining?'Time remaining':'Reservation time ended'}</span><strong>{remaining?`${Math.floor(remaining/3600)}:${String(Math.floor(remaining%3600/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`:'00:00:00'}</strong></div></div>
    <div className="session-times"><p>Start · {local(booking.start)}</p><p>End · {local(booking.end)}</p></div>
    {booking.status==='confirmed'&&remaining>0&&<button className="btn" onClick={()=>onExtend(booking.id)}>Extend Parking</button>}
    <a className="text-link booking-deep-link" href={'/#/driver?booking='+booking.id}>Open this booking</a>
    <p className="fine-print">Countdown follows the server reservation deadline. {booking.session_state==='active'?'The operator-recorded parking session is still active. ':''}Reservation expiration does not confirm physical vehicle departure. Only the assigned operator can record check-in/check-out.</p></>}
  </section>;
}
