// Verify the pre-provisioned fictional driver; no public signup or JSON secrets.
import { fileURLToPath } from 'node:url';
import { readLocalEnv } from './local-env.ts';
import type { FixtureAccount } from './seed.ts';
const base = process.env.PARKLY_TEST_URL || 'http://127.0.0.1:5173';
const origin = new URL(base);
if (origin.origin !== base || origin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origin.hostname)) throw Error('Use the local educational prototype only.');
const env = await readLocalEnv(fileURLToPath(new URL('../.local/', import.meta.url)));
const accounts: FixtureAccount[] = JSON.parse(env.PARKLY_FIXTURE_ACCOUNTS || '[]');
const account = accounts.find(item => item.email === 'driver@test.local');
if (!account) throw Error('Run pnpm dev:fullstack first to provision fictional accounts.');
const response = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: account.email, password: account.password }) });
if (!response.ok) throw Error('Fictional driver login verification failed: ' + response.status);
const cookie = response.headers.get('set-cookie')?.split(';')[0];
if (!cookie) throw Error('Login returned no session cookie.');
const logout = await fetch(base + '/api/v1/auth/logout', { method: 'POST', headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' });
if (!logout.ok) throw Error('Fictional driver logout verification failed.');
console.log('Pre-provisioned fictional driver login/logout verified. Credentials remain in ignored backend/.local/.env.');
