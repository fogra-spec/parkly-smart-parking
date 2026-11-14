import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { Database } from './db.ts';
import { createHttpHandler } from './http-handler.ts';
import type{PushApiConfig} from './push-config.ts';
import {apiPushConfig} from './push-config.ts';

export type ApiOptions = { databaseUrl: string; publicOrigin: string; backendKey?: string; host?: string; port?: number; expiryIntervalMs?: number; push?:PushApiConfig; allowRegistration?: boolean };
export async function startApi(options: ApiOptions) {
  const publicUrl=new URL(options.publicOrigin);
  if(publicUrl.origin!==options.publicOrigin)throw Error('PARKLY_PUBLIC_ORIGIN must be an exact origin without a path.');
  const localPublic=['localhost','127.0.0.1','[::1]'].includes(publicUrl.hostname);
  if(!localPublic&&(publicUrl.protocol!=='https:'||!options.backendKey||options.backendKey.length<32))throw Error('Remote web origins require HTTPS and a strong server-to-server backend key.');
  const host=options.host||'127.0.0.1';
  if(!['127.0.0.1','::1'].includes(host)&&(!options.backendKey||options.backendKey.length<32))throw Error('A non-loopback API listener requires a backend key.');
  const db=new Database(options.databaseUrl);
  try { await db.assertRestrictedRole(); } catch (error) { await db.close(); throw error; }
  const handle = createHttpHandler(db, options);
  const server = createServer(async (req, res) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const init: RequestInit & { duplex?: "half" } = { method: req.method, headers };
      if (!["GET", "HEAD"].includes(req.method || "GET")) {
        init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
        init.duplex = "half";
      }
      const response = await handle(new Request(new URL(req.url || "/", options.publicOrigin), init), req.socket.remoteAddress);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json", "Cache-Control": "private, no-store" });
      res.end(JSON.stringify({ error: { code: "REQUEST_ABORTED", message: "Request was interrupted." } }));
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port??5191,host,()=>resolve());});
  let running=false;
  const timer=setInterval(async()=>{if(running)return;running=true;try{await db.call(null,'SELECT app.expire_due() AS result');}catch{console.error('Expiry sweep failed.');}finally{running=false;}},options.expiryIntervalMs??15000);
  timer.unref();
  let closing:Promise<void>|undefined;
  return{server,db,port:(server.address() as {port:number}).port,close:()=>closing??=(async()=>{clearInterval(timer);await new Promise<void>((resolve,reject)=>server.close(error=>error&&error.message!=='Server is not running.'?reject(error):resolve()));await db.close();})()};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(!process.env.DATABASE_URL||!process.env.PARKLY_PUBLIC_ORIGIN)throw Error('DATABASE_URL and PARKLY_PUBLIC_ORIGIN are required.');
  const configuredPush=apiPushConfig();
  const api=await startApi({push:configuredPush||undefined,databaseUrl:process.env.DATABASE_URL,publicOrigin:process.env.PARKLY_PUBLIC_ORIGIN,
    backendKey:process.env.PARKLY_BACKEND_KEY,host:process.env.PARKLY_API_HOST,port:Number(process.env.PARKLY_API_PORT||5191)});
  console.log(`Parkly PostgreSQL API listening on port ${api.port}`);
  const stop=async()=>{await api.close();process.exit(0);};process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
