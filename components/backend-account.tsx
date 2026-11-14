'use client';
import { useEffect,useState } from 'react';
import { apiCall } from '../lib/api-client';

type Hold={id:string;state:string;total:number;expires_at:string;name:string;space_label:string};
type Session={id:string;name:string;space_label:string;state:string;checked_in_at:string;checked_out_at:string|null;source:string};
const local=(value:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Almaty',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export default function BackendAccount({onChanged}:{onChanged:()=>Promise<unknown>;userId?:string}){
  const[holds,setHolds]=useState<Hold[]>([]),[sessions,setSessions]=useState<Session[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function load(){try{const[h,s]=await Promise.all([apiCall<{holds:Hold[]}>('/holds'),apiCall<{sessions:Session[]}>('/sessions')]);setHolds(h.holds);setSessions(s.sessions);}catch(e){setError((e as Error).message);}}
  useEffect(()=>{void load();},[]);
  async function action(path:string){setBusy(true);setError('');try{await apiCall(path,'POST',{});await load();await onChanged();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="backend-account">
    {error&&<p role="alert" className="inline-error">{error}</p>}
    <h2 className="subheading">Temporary holds</h2><div className="panel">{holds.length?holds.map(h=><div className="admin-row" key={h.id}><div><strong>{h.name} · {h.space_label}</strong><small>Expires {local(h.expires_at)} · {h.total} KZT</small></div><div className="flex-gap"><button className="small-btn" disabled={busy} onClick={()=>action('/holds/'+h.id+'/confirm')}>Confirm</button><button className="small-btn" disabled={busy} onClick={()=>action('/holds/'+h.id+'/cancel')}>Release</button></div></div>):<p className="muted">No active holds. A hold reserves allocated inventory for five minutes before confirmation.</p>}</div>
    <h2 className="subheading">Parking sessions</h2><div className="panel">{sessions.length?sessions.map(s=><div className="admin-row" key={s.id}><div><strong>{s.name} · {s.space_label}</strong><small>{s.state} · Entry {local(s.checked_in_at)}{s.checked_out_at?' · Exit '+local(s.checked_out_at):''}</small><small>Recorded by the operator; physical occupancy is not independently verified.</small></div></div>):<p className="muted">No parking sessions. Only your assigned operator can record entry and exit.</p>}</div>

  </section>;
}
