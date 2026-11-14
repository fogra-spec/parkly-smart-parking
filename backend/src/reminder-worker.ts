import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {viewToken} from './reminder-api.ts';
import {Database} from './db.ts';
import {decryptSubscription,pushKeys,vapidId,type PushKeys} from './push-config.ts';
import {sendWebPush,type PushSender} from './web-push.ts';

export async function startReminderWorker(options:{databaseUrl:string;keys:PushKeys;intervalMs?:number;sender?:PushSender;autoStart?:boolean}){
  const db=new Database(options.databaseUrl);try{await db.assertRestrictedRole();}catch(error){await db.close();throw error;}const worker=randomUUID();let running:Promise<unknown>|null=null,stopped=false;
  const sender=options.sender||sendWebPush;
  async function cycle(){
    await db.pool.query('SELECT app.prepare_parking_reminders($1)',[worker]);
    const rows=(await db.pool.query('SELECT * FROM app.claim_push_deliveries($1)',[worker])).rows;
    await Promise.all(rows.map(async row=>{
      let outcome='failed',http:number|null=null,error:string|null=null,retry=Math.min(120,5*2**(row.attempt-1));
      try{
        const allowed=(await db.pool.query('SELECT app.push_delivery_allowed($1,$2) AS allowed',[row.delivery_id,row.lease_token])).rows[0].allowed;
        if(!allowed){outcome='cancelled';error='NO_LONGER_VALID';}
        else{
          let subscription;
          try{if(row.vapid_key_id!==vapidId(options.keys.publicKey))throw Error('KEY_CHANGED');subscription=decryptSubscription(row.ciphertext,row.user_id,options.keys.encryptionKey);}catch{outcome='invalid_device';error='INVALID_DEVICE_KEYS';}
          if(subscription){const ttl=Math.max(0,Math.min(600,Math.floor((new Date(row.valid_until).getTime()-Date.now())/1000)));
            if(ttl<=0){outcome='cancelled';error='REMINDER_EXPIRED';}
            else{const result=await sender(subscription,{id:row.delivery_id,deviceId:row.device_id,token:viewToken(row.delivery_id,row.device_id,options.keys.encryptionKey)},{ttl,topic:row.reservation_id,keys:options.keys});http=result.status;
              outcome=http>=200&&http<300?'accepted':http===429||http>=500?'retry':'failed';
              error=outcome==='accepted'?null:'PUSH_HTTP_'+http;retry=result.retryAfter??retry;
            }
          }
        }
      }catch{outcome='retry';error='PUSH_NETWORK_ERROR';}
      await db.pool.query('SELECT app.finish_push_delivery($1,$2,$3,$4,$5,$6,$7)',[row.delivery_id,worker,row.lease_token,outcome,http,error,retry]);
    }));
    return rows.length;
  }
  const tick=()=>{if(stopped)return Promise.resolve(0);if(running)return running;running=cycle().finally(()=>{running=null;});return running;};
  const timer=options.autoStart===false?null:setInterval(()=>{void tick().catch(()=>console.error('Reminder worker cycle failed; durable jobs remain queued.'));},options.intervalMs??5000);
  if(options.autoStart!==false)await tick();
  return{tick,db,close:async()=>{stopped=true;if(timer)clearInterval(timer);await running;await db.close();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const keys=await pushKeys();if(!keys||!process.env.PARKLY_NOTIFICATION_DATABASE_URL)throw Error('Configure push secrets and a restricted notification-worker DATABASE_URL.');
  const worker=await startReminderWorker({databaseUrl:process.env.PARKLY_NOTIFICATION_DATABASE_URL,keys});
  console.log('Parkly durable reminder worker started. Push-service acceptance is not proof of device display.');
  let closing=false;const stop=async()=>{if(closing)return;closing=true;await worker.close();process.exit(0);};process.once('SIGINT',stop);process.once('SIGTERM',stop);
  await new Promise(()=>{});
}
