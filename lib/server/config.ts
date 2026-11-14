import type { AuthMode } from '../contracts.ts';

export type AuthConfig = { PARKLY_AUTH_MODE?: string };
export function authMode(url: string, config: AuthConfig): AuthMode {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  // Shared role selection never opens on a remote host, including a LAN host.
  if (config.PARKLY_AUTH_MODE === 'demo') return local ? 'demo' : 'disabled';
  if (config.PARKLY_AUTH_MODE === 'sites') return 'sites';
  if (config.PARKLY_AUTH_MODE === undefined) return local ? 'demo' : 'disabled';
  return 'disabled';
}
