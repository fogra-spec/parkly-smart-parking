import { fileURLToPath } from 'node:url';
import { localCluster } from './cluster.ts';
import { seedFixtures } from './seed.ts';
import {localPushKeys as pushKeys} from './local-push-keys.ts';
import {startReminderWorker} from '../src/reminder-worker.ts';
import { startApi } from '../src/server.ts';

const directory=process.env.PARKLY_PG_DIRECTORY||fileURLToPath(new URL('../.local/',import.meta.url));
const runtime=await localCluster(directory,Number(process.env.PARKLY_PG_PORT||55432));
try{
  await seedFixtures(runtime.settings.ownerUrl,runtime.root);
  const keys=(await pushKeys(runtime.root))!;
  const worker=await startReminderWorker({databaseUrl:runtime.settings.notificationUrl!,keys});
  const api=await startApi({push:{publicKey:keys.publicKey,encryptionKey:keys.encryptionKey},databaseUrl:runtime.settings.apiUrl,publicOrigin:process.env.PARKLY_PUBLIC_ORIGIN||'http://127.0.0.1:5173',port:Number(process.env.PARKLY_API_PORT||5191)});
  console.log(`Parkly PostgreSQL API ready on http://127.0.0.1:${api.port}`);
  console.log('Server reminder worker is running; all local secrets are in ignored backend/.local/.env.');
  console.log('Educational prototype. Sign in as driver@test.local or operator@test.local with the private .env credentials. Public registration is disabled.');
  let stopping=false;
  const stop=async()=>{if(stopping)return;stopping=true;await api.close();await worker.close();await runtime.cluster.stop();process.exit(0);};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch(e){await runtime.cluster.stop();throw e;}
