import { env } from 'cloudflare:workers';
import type { AuthMode, User } from '../contracts';
import { authMode } from './config';
import { database } from './database';

export function requestAuthMode(req: Request): AuthMode { return authMode(req.url, env); }

function sessionToken(req: Request): string | null {
  const token = req.headers.get('cookie')?.match(/(?:^|;\s*)parkly_session=([^;]+)/)?.[1];
  return token && /^[a-f0-9-]{36}$/i.test(token) ? token : null;
}
async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function currentUser(req: Request): Promise<User | null> {
  const mode = requestAuthMode(req);
  if (mode === 'disabled') return null;
  if (mode === 'sites') {
    // Trust these headers ONLY behind the Sites identity gateway. Other hosts
    // must strip them and provide their own verified identity adapter.
    const identity = req.headers.get('oai-authenticated-user-id');
    if (!identity || !req.headers.get('oai-authenticated-user-email')) return null;
    const id = 'site:' + await digest(identity);
    await database().prepare("INSERT OR IGNORE INTO users (id,name,role,active) VALUES (?,?,'driver',1)")
      .bind(id, 'Parkly driver').run();
    return database().prepare('SELECT id,name,role,active FROM users WHERE id=? AND active=1').bind(id).first<User>();
  }
  const token = sessionToken(req);
  if (!token) return null;
  // Legacy UUID sessions expire on their existing one-day schedule.
  return database().prepare(`SELECT u.id,u.name,u.role,u.active FROM users u
    JOIN sessions s ON s.user_id=u.id
    WHERE s.token IN (?,?) AND s.expires>? AND u.active=1`)
    .bind(await digest(token), token, Date.now()).first<User>();
}
export async function clearSession(req: Request): Promise<void> {
  const token = sessionToken(req);
  if (token) await database().prepare('DELETE FROM sessions WHERE token IN (?,?)').bind(await digest(token), token).run();
}
export async function createDemoSession(req: Request, id: string): Promise<string> {
  await clearSession(req);
  const token = crypto.randomUUID();
  await database().batch([
    database().prepare('DELETE FROM sessions WHERE expires<=?').bind(Date.now()),
    database().prepare('INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)')
      .bind(await digest(token), id, Date.now() + 86_400_000),
  ]);
  return token;
}
export function sessionCookie(req: Request, token = ''): string {
  return `parkly_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${token ? 86400 : 0}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
}
