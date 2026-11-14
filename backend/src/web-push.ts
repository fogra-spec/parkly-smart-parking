import https from 'node:https';
import {lookup} from 'node:dns';
import {BlockList,isIP} from 'node:net';
import type {LookupFunction} from 'node:net';
import {createHash} from 'node:crypto';
import webpush from 'web-push';
import {allowedPushEndpoint,type PushKeys,type Subscription} from './push-config.ts';

const blocked=new BlockList();
for(const[network,bits]of[['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['192.0.0.0',24],['192.0.2.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as [string,number][])blocked.addSubnet(network,bits,'ipv4');
const global6=new BlockList();global6.addSubnet('2000::',3,'ipv6');blocked.addSubnet('2001:db8::',32,'ipv6');
export function publicPushAddress(address:string):boolean{return isIP(address)===4?!blocked.check(address,'ipv4'):isIP(address)===6&&global6.check(address,'ipv6')&&!blocked.check(address,'ipv6');}
const publicLookup:LookupFunction=(host,options,callback)=>{
  lookup(host,{all:true},(error,addresses)=>{if(error){callback(error,[]);return;}const safe=addresses.filter(a=>publicPushAddress(a.address));if(!safe.length){callback(Error('UNSAFE_PUSH_ADDRESS'),[]);return;}if(options.all)callback(null,safe);else callback(null,safe[0].address,safe[0].family);});
};
const agent=new https.Agent({keepAlive:true,lookup:publicLookup});
export type PushResult={status:number;retryAfter?:number};
export type PushSender=(subscription:Subscription,payload:{id:string;deviceId:string;token:string},options:{ttl:number;topic:string;keys:PushKeys})=>Promise<PushResult>;
export const sendWebPush:PushSender=async(subscription,payload,options)=>{
  if(!allowedPushEndpoint(subscription.endpoint))throw Error('UNSAFE_PUSH_ENDPOINT');
  const details=webpush.generateRequestDetails(subscription,JSON.stringify(payload),{vapidDetails:{subject:options.keys.subject,publicKey:options.keys.publicKey,privateKey:options.keys.privateKey},TTL:options.ttl,topic:createHash('sha256').update(options.topic).digest('base64url').slice(0,32),urgency:'high',contentEncoding:'aes128gcm'});
  return new Promise<PushResult>((resolve,reject)=>{
    const request=https.request(details.endpoint,{method:details.method,headers:details.headers,agent,signal:AbortSignal.timeout(10000)},response=>{
      response.resume();response.once('error',reject);response.once('end',()=>{const raw=response.headers['retry-after'],seconds=raw?Number(raw):NaN;resolve({status:response.statusCode||0,retryAfter:Number.isFinite(seconds)?Math.max(1,Math.min(120,seconds)):undefined});});
    });
    request.once('error',()=>reject(Error('PUSH_NETWORK_ERROR')));if(details.body)request.write(details.body);request.end();
  });
};
