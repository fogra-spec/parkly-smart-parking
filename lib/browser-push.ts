export function pushSupport():{supported:boolean;message:string}{
  if(typeof window==='undefined')return{supported:false,message:'Checking notification support…'};
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const installed=matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  if(!window.isSecureContext)return{supported:false,message:'Push requires HTTPS. Loopback is suitable for desktop development; a phone needs an HTTPS origin.'};
  if(ios&&!installed)return{supported:false,message:'On iPhone or iPad, add Parkly to your Home Screen, open the installed app, then enable reminders. iOS/iPadOS 16.4 or later is required.'};
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))return{supported:false,message:'This browser does not expose Web Push. Use a compatible desktop/Android browser or an installed iOS Home Screen PWA. In-app history is still available.'};
  if(Notification.permission==='denied')return{supported:false,message:'Notifications are blocked. Allow Parkly in browser or system notification settings, then refresh. Parkly cannot override that setting.'};
  return{supported:true,message:'Push reminders are sent by the server while Parkly is closed. Browser/OS settings and connectivity can delay delivery.'};
}
export async function pushRegistration():Promise<ServiceWorkerRegistration>{
  const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  if(registration.installing){const installing=registration.installing;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('The service worker update timed out. Reload Parkly.')),10000);const check=()=>{if(['installed','activated'].includes(installing.state)){clearTimeout(timer);resolve();}else if(installing.state==='redundant'){clearTimeout(timer);reject(Error('The service worker could not be installed.'));}};installing.addEventListener('statechange',check);check();});}
  if(registration.waiting){registration.waiting.postMessage({type:'PARKLY_ACTIVATE_UPDATE'});await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Reload Parkly to activate updated notification support.')),7000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});});}
  return navigator.serviceWorker.ready;
}
export async function bindPushDevice(registration:ServiceWorkerRegistration,deviceId:string):Promise<void>{
  await new Promise<void>((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('Reload Parkly to activate notification support.')),5000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();if(event.data?.ok)resolve();else reject(Error('This browser cannot store the device binding. Disable private browsing or use another browser.'));};registration.active?.postMessage({type:'PARKLY_PUSH_BIND',deviceId},[channel.port2]);});
}
export async function clearPushBinding():Promise<void>{
  if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.getRegistration('/');registration?.active?.postMessage({type:'PARKLY_PUSH_CLEAR'});}
}
export async function disconnectBrowserPush():Promise<void>{
  if(!('serviceWorker'in navigator))return;
  await clearPushBinding();
  const registration=await navigator.serviceWorker.getRegistration('/'),subscription=await registration?.pushManager?.getSubscription();
  if(!subscription)return;
  try{
    const result=await fetch('/api/v1/push/current',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint}),signal:AbortSignal.timeout(3000)});
    if(result.ok){const data=await result.json() as {device?:{id?:unknown}|null};const id=data.device?.id;if(typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id))await fetch('/api/v1/push-subscriptions/'+encodeURIComponent(id),{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(3000)});}
  }finally{await subscription.unsubscribe();}
}
export function publicVapidKey(value:string):Uint8Array<ArrayBuffer>{
  const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/')),result=new Uint8Array(new ArrayBuffer(binary.length));for(let i=0;i<binary.length;i++)result[i]=binary.charCodeAt(i);return result;
}
