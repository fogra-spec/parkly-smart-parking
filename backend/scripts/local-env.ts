import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Development secrets stay outside the runtime dependency graph and Git.
export async function readLocalEnv(directory: string): Promise<Record<string, string>> {
  try {
    const parsed = parseEnv(await readFile(resolve(directory, '.env'), 'utf8'));
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => entry[1] !== undefined));
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
}

export async function writeLocalEnv(directory: string, values: Record<string, string>): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const merged = { ...await readLocalEnv(directory), ...values };
  const lines = Object.entries(merged).map(([key, value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /['\r\n]/.test(value)) throw Error('Invalid local environment value.');
    return `${key}='${value}'`;
  });
  const file = resolve(directory, '.env');
  await writeFile(file + '.next', '# Private fictional local setup. Never commit or share.\n' + lines.join('\n') + '\n', { mode: 0o600 });
  await chmod(file + '.next', 0o600);
  await rename(file + '.next', file);
}

export async function legacyJson<T>(directory: string, name: string): Promise<T | null> {
  try { return JSON.parse(await readFile(resolve(directory, name), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

export async function removeLegacySecret(directory: string, name: string): Promise<void> {
  await unlink(resolve(directory, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
