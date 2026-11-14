import EmbeddedPostgres from 'embedded-postgres';
import { mkdir, access, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { migrate } from './migrate.ts';
import { readLocalEnv, writeLocalEnv, legacyJson, removeLegacySecret } from './local-env.ts';

export type LocalSettings = { port: number; ownerPassword: string; apiPassword: string; ownerUrl: string; apiUrl: string; notificationPassword?:string; notificationUrl?:string };
export async function localCluster(directory: string, port: number) {
  process.umask(0o077);
  const root = resolve(directory); await mkdir(root, { recursive: true, mode: 0o700 });
  const env = await readLocalEnv(root);
  let settings: LocalSettings | null = env.PARKLY_LOCAL_DATABASE_SETTINGS
    ? JSON.parse(env.PARKLY_LOCAL_DATABASE_SETTINGS) : await legacyJson<LocalSettings>(root, 'runtime.json');
  if (!settings) {
    const ownerPassword = randomBytes(32).toString('hex'), apiPassword = randomBytes(32).toString('hex');
    settings = { port, ownerPassword, apiPassword,
      ownerUrl: `postgresql://parkly_owner:${ownerPassword}@127.0.0.1:${port}/parkly`,
      apiUrl: `postgresql://parkly_api:${apiPassword}@127.0.0.1:${port}/parkly` };
  }
  if(!settings.notificationPassword){settings.notificationPassword=randomBytes(32).toString('hex');settings.notificationUrl=`postgresql://parkly_notify:${settings.notificationPassword}@127.0.0.1:${port}/parkly`;}
  if (settings.port !== port) throw Error('Local cluster port differs from the stored configuration. Use a new directory or its original port.');
  await writeLocalEnv(root, { PARKLY_LOCAL_DATABASE_SETTINGS: JSON.stringify(settings), DATABASE_URL: settings.apiUrl,
    MIGRATION_DATABASE_URL: settings.ownerUrl, PARKLY_NOTIFICATION_DATABASE_URL: settings.notificationUrl! });
  await removeLegacySecret(root, 'runtime.json');
  // npm omits symlinks; run ONLY the inspected, platform-specific hydration
  // script. No downloader, root user creation or global installation is used.
  const require = createRequire(import.meta.resolve('embedded-postgres'));
  const native = dirname(dirname(require.resolve(`@embedded-postgres/${process.platform}-${process.arch}`)));
  execFileSync(process.execPath, [resolve(native, 'scripts/hydrate-symlinks.js')], { cwd: native, stdio: 'ignore' });
  const cluster = new EmbeddedPostgres({ databaseDir: resolve(root, 'data'), user: 'parkly_owner',
    password: settings.ownerPassword, port, authMethod: 'scram-sha-256', persistent: true,
    createPostgresUser: false, initdbFlags: ['--encoding=UTF8','--locale=C'],
    postgresFlags: ['-h','127.0.0.1','-k',root,'-c','timezone=UTC','-c','log_statement=none'],
    onLog: message => { void appendFile(resolve(root,'postgres.log'), String(message), { mode: 0o600 }); },
    onError: () => console.error('Local PostgreSQL connection error; inspect the private runtime log.'),
  });
  let initialized = true;
  try { await access(resolve(root,'data/PG_VERSION')); } catch { initialized = false; }
  if (!initialized) await cluster.initialise();
  await cluster.start();
  const owner = cluster.getPgClient('postgres','127.0.0.1'); await owner.connect();
  try {
    if (!(await owner.query("SELECT 1 FROM pg_database WHERE datname='parkly'")).rowCount) await owner.query('CREATE DATABASE parkly');
  } finally { await owner.end(); }
  await migrate(settings.ownerUrl);
  const provision = cluster.getPgClient('parkly','127.0.0.1'); await provision.connect();
  try {
    if (!(await provision.query("SELECT 1 FROM pg_roles WHERE rolname='parkly_api'")).rowCount) {
      await provision.query(`CREATE ROLE parkly_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${provision.escapeLiteral(settings.apiPassword)}`);
    }
    await provision.query('GRANT parkly_app TO parkly_api');
    if(!(await provision.query("SELECT 1 FROM pg_roles WHERE rolname='parkly_notify'")).rowCount)await provision.query(`CREATE ROLE parkly_notify LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${provision.escapeLiteral(settings.notificationPassword!)}`);
    await provision.query('GRANT parkly_notifications TO parkly_notify');
  } finally { await provision.end(); }
  return { cluster, settings, root };
}
