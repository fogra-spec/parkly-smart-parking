import {ECDH,createECDH,createCipheriv,createDecipheriv,createHash,createHmac,randomBytes} from 'node:crypto';
import webpush from 'web-push';

export type PushKeys={publicKey:string;privateKey:string;subject:string;encryptionKey:string};
export type PushApiConfig=Pick<PushKeys,'publicKey'|'encryptionKey'>;
export type Subscription={endpoint:string;keys:{p256dh:string;auth:string}};
export const vapidId=(publicKey:string)=>createHash('sha256').update(publicKey).digest('hex').slice(0,24);
export const PUSH_HOSTS=['fcm.googleapis.com','updates.push.services.mozilla.com','push.services.mozilla.com','web.push.apple.com'];
export function allowedPushEndpoint(value:string):boolean{
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&(!url.port||url.port==='443')&&value.length<2048&&
    (PUSH_HOSTS.includes(url.hostname)||url.hostname.endsWith('.push.apple.com')||url.hostname.endsWith('.notify.windows.com'));}catch{return false;}
}
export function validateSubscription(s:Subscription):boolean{
  const key=Buffer.from(s.keys.p256dh,'base64url'),auth=Buffer.from(s.keys.auth,'base64url');
  try{ECDH.convertKey(key,'prime256v1');return allowedPushEndpoint(s.endpoint)&&key.length===65&&key[0]===4&&auth.length===16;}catch{return false;}
}
export function encryptSubscription(s:Subscription,user:string,key:string):string{
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'base64url'),nonce);cipher.setAAD(Buffer.from(user));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(s)),cipher.final()]);
  return[nonce,cipher.getAuthTag(),ciphertext].map(v=>v.toString('base64url')).join('.');
}
export function decryptSubscription(value:string,user:string,key:string):Subscription{
  const[iv,tag,ciphertext]=value.split('.').map(v=>Buffer.from(v,'base64url'));
  const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64url'),iv);decipher.setAAD(Buffer.from(user));decipher.setAuthTag(tag);
  const subscription=JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8')) as Subscription;
  if(!validateSubscription(subscription))throw Error('INVALID_SUBSCRIPTION');return subscription;
}
export const endpointHash=(endpoint:string,key:string)=>createHmac('sha256',Buffer.from(key,'base64url')).update(endpoint).digest('hex');
export function apiPushConfig():PushApiConfig|null{
  const publicKey=process.env.PARKLY_VAPID_PUBLIC_KEY,encryptionKey=process.env.PARKLY_PUSH_ENCRYPTION_KEY;
  if(!publicKey&&!encryptionKey)return null;
  if(!publicKey||!encryptionKey||Buffer.from(encryptionKey,'base64url').length!==32)throw Error('Configure the API public VAPID key and 32-byte encryption key together.');
  if(Buffer.from(publicKey,'base64url').length!==65||ECDH.convertKey(Buffer.from(publicKey,'base64url'),'prime256v1').length!==65)throw Error('Invalid VAPID public key.');
  return{publicKey,encryptionKey};
}
export async function pushKeys():Promise<PushKeys|null>{
  const values=[process.env.PARKLY_VAPID_PUBLIC_KEY,process.env.PARKLY_VAPID_PRIVATE_KEY,process.env.PARKLY_VAPID_SUBJECT,process.env.PARKLY_PUSH_ENCRYPTION_KEY];
  let keys:PushKeys;
  if(values.some(Boolean)){
    if(!values.every(Boolean))throw Error('Configure all four push secrets; partial configuration is rejected.');
    keys={publicKey:values[0]!,privateKey:values[1]!,subject:values[2]!,encryptionKey:values[3]!};
  }else return null;
  return validatePushKeys(keys);
}
export function validatePushKeys(keys:PushKeys):PushKeys{
  if(Buffer.from(keys.encryptionKey,'base64url').length!==32)throw Error('PARKLY_PUSH_ENCRYPTION_KEY must encode 32 bytes.');
  const pair=createECDH('prime256v1');pair.setPrivateKey(Buffer.from(keys.privateKey,'base64url'));
  if(!pair.getPublicKey().equals(Buffer.from(keys.publicKey,'base64url')))throw Error('The VAPID public/private keys do not match.');
  webpush.generateRequestDetails({endpoint:'https://fcm.googleapis.com/fcm/send/configuration-check',keys:{p256dh:keys.publicKey,auth:randomBytes(16).toString('base64url')}},undefined,{vapidDetails:{subject:keys.subject,publicKey:keys.publicKey,privateKey:keys.privateKey}});
  return keys;
}
