import { env } from 'cloudflare:workers';
import { demoLots } from '../demo';
import type { AuthMode } from '../contracts';

export function database(): D1Database {
  if (!env.DB) throw new Error('Database binding unavailable');
  return env.DB;
}

/** Fictional fixtures are allowed only in the loopback classroom mode. */
export async function ensureDemoFixtures(mode: AuthMode): Promise<void> {
  if (mode !== 'demo') return;
  const db = database();
  const present = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE id IN ('driver','operator','operator-east','admin')").first<{ n: number }>();
  if (present?.n === 4) return;
  const users = [
    ['driver', 'Alex, demo driver', 'driver'],
    ['operator', 'North Parking, demo partner', 'operator'],
    ['operator-east', 'East Parking, demo partner', 'operator'],
    ['admin', 'Demo administrator', 'admin'],
  ];
  await db.batch([
    ...users.map(u => db.prepare('INSERT OR IGNORE INTO users (id,name,role,active) VALUES (?,?,?,1)').bind(...u)),
    ...demoLots.map(p => db.prepare(`INSERT OR IGNORE INTO lots
      (id,owner,name,area,lat,lng,type,price,capacity,approved) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(p.id, p.owner, p.name, p.area, p.lat, p.lng, p.type, p.price, p.capacity, p.approved)),
  ]);
}

/** The mutation and its audit record either both commit or both roll back. */
export async function auditedMutation(statement: D1PreparedStatement, actor: string, action: string, target: string) {
  const result = await database().batch([
    statement,
    database().prepare(`INSERT INTO audit_events (id,actor_id,action,target_id,created)
      SELECT ?,?,?,?,? WHERE changes() > 0`)
      .bind(crypto.randomUUID(), actor, action, target, Date.now()),
  ]);
  return result[0];
}
