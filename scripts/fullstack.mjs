// Local development only: no deployments, global installs, database resets or
// production credentials. Each service keeps its existing standalone command.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;
  // Ctrl+C already reaches the foreground process group. Give each service's
  // native handler time to close before forwarding a second stop signal.
  setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');},500).unref();
  setTimeout(()=>process.exit(code),2000).unref();
}
process.once('SIGINT',()=>stop());process.once('SIGTERM',()=>stop());
const api=spawn(process.execPath,['--experimental-strip-types','backend/scripts/local.ts'],{
  cwd:root,env:{...process.env,PARKLY_PUBLIC_ORIGIN:'http://127.0.0.1:5173',PARKLY_API_PORT:'5191'},stdio:['inherit','pipe','inherit']});
children.push(api);
let webStarted=false;
api.stdout.on('data',chunk=>{
  process.stdout.write(chunk);
  if(!webStarted&&String(chunk).includes('PostgreSQL API ready')){
    webStarted=true;
    const web=spawn(process.execPath,['scripts/run-framework.mjs','dev'],{cwd:root,env:{...process.env,PARKLY_BACKEND_URL:'http://127.0.0.1:5191'},stdio:'inherit'});
    children.push(web);web.once('exit',code=>stop(code||0));
    console.log('Open http://127.0.0.1:5173 — PostgreSQL-backed Parkly. Ctrl+C stops both services; data is retained.');
  }
});
api.once('exit',code=>stop(code||0));
