'use client';
import {useCallback,useEffect,useState} from 'react';
import {Bell,Smartphone} from 'lucide-react';
import {apiCall} from '../lib/api-client';
import {pushSupport,pushRegistration,bindPushDevice,publicVapidKey,clearPushBinding} from '../lib/browser-push';

type Preferences={in_app:boolean;push:boolean;remind_30:boolean;remind_15:boolean;remind_5:boolean;remind_end:boolean};
type Device={id:string;label:string;active:boolean;disabled_reason:string|null};
type Delivery={id:string;kind:string;state:string;attempts:number;last_http_status:number|null;last_error_code:string|null;display_requested_at:string|null};
type Config={configured:boolean;publicKey:string|null;keyId:string|null;workerHealthy:boolean};
const defaults:Preferences={in_app:true,push:false,remind_30:true,remind_15:true,remind_5:true,remind_end:true};
export default function NotificationSettings({userId}:{userId:string}){
  const[config,C]=useState<Config|null>(null),[prefs,P]=useState(defaults),[devices,Ds]=useState<Device[]>([]),[device,Dev]=useState<string|null>(null),[deliveries,H]=useState<Delivery[]>([]),[bookings,Bk]=useState<{id:string;user_id:string;name:string;status:string;end:number}[]>([]),[booking,Bkg]=useState(''),[busy,B]=useState(false),[error,E]=useState(''),[notice,N]=useState(''),[support,S]=useState({supported:false,message:'Checking notification support…'}),[label,L]=useState('This device');
  const load=useCallback(async()=>{
    const[c,p,d,h,b]=await Promise.all([apiCall<Config>('/push/config'),apiCall<{preferences:Preferences}>('/notifications/preferences'),apiCall<{devices:Device[]}>('/push/devices'),apiCall<{deliveries:Delivery[]}>('/notifications/delivery-history'),apiCall<{reservations:{id:string;user_id:string;name:string;status:string;end:number}[]}>('/reservations?scope=own&bucket=current&limit=200')]);
    C(c);P(p.preferences||defaults);Ds(d.devices);H(h.deliveries);const eligible=b.reservations.filter(r=>r.user_id===userId&&r.status==='confirmed'&&r.end>Date.now());Bk(eligible);Bkg(old=>eligible.some(b=>b.id===old)?old:eligible[0]?.id||'');S(pushSupport());
    if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager?.getSubscription();if(subscription){const current=await apiCall<{device:{id:string}|null}>('/push/current','POST',{endpoint:subscription.endpoint});Dev(current.device?.id||null);}else Dev(null);}
  },[userId]);
  useEffect(()=>{void load().catch(e=>E(e.message));const reconnect=(event:MessageEvent)=>{if(event.data?.type==='PARKLY_PUSH_RECONNECT'){Dev(null);N('The browser subscription changed. Enable reminders again to reconnect.');}};navigator.serviceWorker?.addEventListener('message',reconnect);return()=>navigator.serviceWorker?.removeEventListener('message',reconnect);},[load]);
  async function preferences(next:Preferences){B(true);E('');try{await apiCall('/notifications/preferences','PATCH',{inApp:next.in_app,push:next.push,remind30:next.remind_30,remind15:next.remind_15,remind5:next.remind_5,remindEnd:next.remind_end});P(next);N('Preferences saved. They apply to future unsent reminders.');}catch(e){E((e as Error).message);}finally{B(false);}}
  async function enable(){
    if(!config?.publicKey||!support.supported)return;B(true);E('');N('');let registered:string|null=null;
    try{
      // This call runs immediately inside the user's click, before any awaits.
      const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Permission was not granted. Change browser settings to try again.');
      const registration=await pushRegistration();let subscription=await registration.pushManager.getSubscription();
      // Explicit reconnect replaces stale native endpoints as well as their
      // account binding; other devices remain subscribed.
      if(subscription){if(device)await apiCall('/push-subscriptions/'+device,'DELETE',{});await clearPushBinding();await subscription.unsubscribe();subscription=null;}
      subscription??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicVapidKey(config.publicKey)});
      const json=subscription.toJSON();if(!json.keys?.p256dh||!json.keys?.auth)throw Error('The browser did not return a valid push subscription.');
      const result=await apiCall<{subscription:{id:string}}>('/push-subscriptions','POST',{endpoint:subscription.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth,label});registered=result.subscription.id;
      await bindPushDevice(registration,registered);await apiCall('/notifications/preferences','PATCH',{inApp:prefs.in_app,push:true,remind30:prefs.remind_30,remind15:prefs.remind_15,remind5:prefs.remind_5,remindEnd:prefs.remind_end});
      await load();N('This device is subscribed. Delivery depends on browser/OS settings; you can queue a real test below.');
    }catch(e){if(registered)await apiCall('/push-subscriptions/'+registered,'DELETE',{}).catch(()=>{});E((e as Error).message);S(pushSupport());}finally{B(false);}
  }
  async function revoke(id:string){B(true);E('');try{await apiCall('/push-subscriptions/'+id,'DELETE',{});if(id===device){const r=await navigator.serviceWorker.getRegistration('/');await(await r?.pushManager.getSubscription())?.unsubscribe();await clearPushBinding();Dev(null);}await load();N('Subscription disabled. Pending deliveries for this device were cancelled.');}catch(e){E((e as Error).message);}finally{B(false);}}
  return <section className="panel reminder-settings" id="notification-settings"><div className="row"><h2><Bell size={21}/>Parking reminders</h2><button className="small-btn" disabled={busy} onClick={()=>void load().catch(e=>E(e.message))}>Refresh status</button></div>
    <p className="muted">Scheduled on the server at 30, 15 and 5 minutes before the end, and at expiration. No open tab is needed.</p>
    {error&&<p role="alert" className="inline-error">{error}</p>}{notice&&<p role="status" className="floor-notice">{notice}</p>}
    {!config?<p>{error?'Reminder settings could not load. Use Refresh status.':'Loading reminder settings…'}</p>:<><p className="reminder-status">{config.configured?(config.workerHealthy?'Server reminder worker is running.':'Worker heartbeat is stale. Reminders remain queued until the worker recovers.'):'Push is not configured on the server. In-app history remains available.'}</p>
    <p className="fine-print">{support.message}</p><fieldset disabled={busy} className="reminder-preferences"><legend>Notification preferences</legend>
      <label><input type="checkbox" checked={prefs.in_app} onChange={e=>void preferences({...prefs,in_app:e.target.checked})}/>Save in-app notification history</label>
      <label><input type="checkbox" checked={prefs.push} onChange={e=>void preferences({...prefs,push:e.target.checked})}/>Send push reminders to enabled devices</label>
      {([['remind_30','30 minutes before ending'],['remind_15','15 minutes before ending'],['remind_5','5 minutes before ending'],['remind_end','At reservation expiration']] as const).map(([key,text])=><label key={key}><input type="checkbox" checked={prefs[key]} onChange={e=>void preferences({...prefs,[key]:e.target.checked})}/>{text}</label>)}
    </fieldset><div className="reminder-device-controls"><label>Device name<input value={label} maxLength={60} minLength={1} onChange={e=>L(e.target.value)} disabled={busy}/></label><button className="btn" disabled={busy||!config.configured||!support.supported||!label.trim()} onClick={enable}><Smartphone size={17}/>{device?'Reconnect this device':'Enable reminders on this device'}</button></div>
    <p className="fine-print">On iPhone/iPad: open the installed Home Screen PWA. After signing out, enable reminders again when you sign back in. Signing out revokes that session’s device subscriptions.</p>
    {devices.filter(d=>d.active).map(d=><div className="admin-row" key={d.id}><span><strong>{d.label}</strong><small>{d.id===device?'This browser device':'Account device'}</small></span><button className="small-btn" disabled={busy} onClick={()=>void revoke(d.id)}>Unsubscribe</button></div>)}
    <div className="reminder-test"><h3>Test the real delivery path</h3><p className="fine-print">Queues a clearly labelled test push for your selected reservation. It does not change your reservation time. Check the attempt log; acceptance is not proof of device display.</p><label>Own reservation<select value={booking} onChange={e=>Bkg(e.target.value)}>{bookings.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button className="outline-btn" disabled={busy||!device||!prefs.push||!booking||!config.workerHealthy} onClick={async()=>{B(true);E('');try{await apiCall('/notifications/test','POST',{bookingId:booking,deviceId:device,idempotencyKey:crypto.randomUUID()});N('Test queued on the server. Refresh status to inspect the actual delivery attempt.');}catch(e){E((e as Error).message);}finally{B(false);}}}>Queue test reminder</button></div>
    <h3>Recent push attempts</h3>{deliveries.length?deliveries.slice(0,8).map(d=><p className="small" key={d.id}><strong>{d.kind==='end'?'Expiration':d.kind==='test'?'Test':d.kind+' minute reminder'}</strong> · {d.state==='accepted'?'Accepted by push service':d.state} · {d.attempts} attempt(s){d.last_http_status?' · HTTP '+d.last_http_status:''}{d.display_requested_at?' · browser display requested':''}{d.last_error_code?' · '+d.last_error_code:''}</p>):<p className="muted small">No push attempts yet. No successful delivery is assumed.</p>}</>}
  </section>;
}
