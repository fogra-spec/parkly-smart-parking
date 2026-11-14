import { localCluster } from './cluster.ts';
const runtime = await localCluster(process.env.PARKLY_PG_DIRECTORY || '/private/tmp/parkly-pg-schema-check', Number(process.env.PARKLY_PG_PORT || 55433));
try { console.log('PostgreSQL migrations and restricted API role provisioned successfully.'); }
finally { await runtime.cluster.stop(); }
