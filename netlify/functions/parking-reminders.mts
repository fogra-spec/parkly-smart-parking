import { Database } from '../../backend/src/db.ts';
import { pushKeys } from '../../backend/src/push-config.ts';
import { startReminderWorker } from '../../backend/src/reminder-worker.ts';

// The platform scheduler runs without a visitor or an open browser tab.
// Existing SQL leases, reminder versions and delivery IDs prevent duplicates.
export default async function handler() {
  const keys = await pushKeys();
  if (keys) {
    const databaseUrl = process.env.PARKLY_NOTIFICATION_DATABASE_URL;
    if (!databaseUrl) throw Error('The restricted reminder database login is required.');
    const worker = await startReminderWorker({ databaseUrl, keys, autoStart: false });
    try { await worker.tick(); } finally { await worker.close(); }
  } else {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw Error('The restricted API database login is required.');
    const db = new Database(databaseUrl);
    try { await db.assertRestrictedRole(); await db.call(null, 'SELECT app.expire_due() AS result'); }
    finally { await db.close(); }
  }
  return new Response(null, { status: 204 });
}

export const config = { schedule: '* * * * *' };
