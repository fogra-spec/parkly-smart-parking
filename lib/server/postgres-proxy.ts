import { env } from 'cloudflare:workers';

export const usesPostgres = () => Boolean(env.PARKLY_BACKEND_URL);
export async function postgresProxy(req: Request, path?: string): Promise<Response> {
  try {
    const target = new URL(env.PARKLY_BACKEND_URL || '');
    const local = ['127.0.0.1','localhost','[::1]'].includes(target.hostname);
    if (target.username || target.password || target.pathname !== '/' || target.search || target.hash ||
        (!local && (target.protocol !== 'https:' || !env.PARKLY_BACKEND_KEY || env.PARKLY_BACKEND_KEY.length < 32))) throw Error('Invalid backend configuration');
    if (!['http:','https:'].includes(target.protocol)) throw Error('Invalid backend protocol');
    const source = new URL(req.url);
    const destination = new URL(path || source.pathname + source.search, target);
    if (destination.origin !== target.origin || !destination.pathname.startsWith('/api/v1/')) throw Error('Invalid backend path');
    const headers = new Headers({ 'Accept':'application/json' });
    for(const name of ['cookie','content-type','sec-fetch-site','x-parkly-push-token','x-parkly-push-device']){const value=req.headers.get(name);if(value)headers.set(name,value);}
    headers.set('Origin',req.headers.get('origin') || (['GET','HEAD'].includes(req.method)?source.origin:''));
    if(env.PARKLY_BACKEND_KEY)headers.set('X-Parkly-Backend-Key',env.PARKLY_BACKEND_KEY);
    let body:string|undefined;
    if(!['GET','HEAD'].includes(req.method)){
      const reader=req.body?.getReader();if(!reader)return Response.json({error:{code:'INVALID_JSON',message:'A JSON body is required.'}},{status:400});
      const decoder=new TextDecoder();let size=0;body='';const bodyLimit=req.method==='PATCH'&&/^\/api\/v1\/operator\/floors\/[0-9a-f-]+\/layout$/.test(new URL(req.url).pathname)?262144:8192;
      for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>bodyLimit){await reader.cancel();return Response.json({error:{code:'BODY_TOO_LARGE',message:'Request body is too large.'}},{status:413});}body+=decoder.decode(part.value,{stream:true});}
      body+=decoder.decode();
    }
    const upstream=await fetch(destination,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(15000)});
    if(upstream.status>=300&&upstream.status<400)throw Error('Unexpected backend redirect');
    const responseHeaders=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'});
    for(const name of ['set-cookie','x-request-id']){const value=upstream.headers.get(name);if(value)responseHeaders.set(name,value);}
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  } catch {
    return Response.json({error:{code:'BACKEND_UNAVAILABLE',message:'The PostgreSQL service is unavailable. Please try again.'}},{status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
