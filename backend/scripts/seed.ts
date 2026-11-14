import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/password.ts';
import { demoLots } from '../../lib/demo.ts';
import { readLocalEnv, writeLocalEnv, legacyJson, removeLegacySecret } from './local-env.ts';

export type FixtureAccount = { id: string; email: string; password: string; role: string };
export async function seedFixtures(ownerUrl: string, directory: string): Promise<FixtureAccount[]> {
  if(!['127.0.0.1','localhost','[::1]'].includes(new URL(ownerUrl).hostname))throw Error('Fictional fixtures may only be seeded into a local development database.');
  const env = await readLocalEnv(directory);
  const existing: FixtureAccount[] | null = env.PARKLY_FIXTURE_ACCOUNTS
    ? JSON.parse(env.PARKLY_FIXTURE_ACCOUNTS) : await legacyJson<FixtureAccount[]>(directory, 'fixture-accounts.json');
  const client=new pg.Client({connectionString:ownerUrl});await client.connect();
  const accounts:FixtureAccount[]=existing || [];
  try{
    if (!existing) {
    if((await client.query('SELECT count(*)::int AS n FROM app.facilities')).rows[0].n)throw Error('Database is not empty; refusing to seed or overwrite accounts.');
    await client.query('BEGIN');
    for(const [role,name] of [['admin','Local fixture administrator'],['operator','North Parking fixture operator'],['operator-east','East Parking fixture operator']]){
      const email=role+'@parkly.example',password=randomBytes(24).toString('base64url');
      const identity=(await client.query('SELECT auth.register_account($1,$2,$3) AS id',[email,name,await hashPassword(password)])).rows[0].id;
      accounts.push({id:identity,email,password,role});
    }
    const administrator=accounts[0];
    await client.query("INSERT INTO app.user_roles(user_id,role) VALUES($1,'admin')",[administrator.id]);
    await client.query("SELECT set_config('parkly.user_id',$1,true)",[administrator.id]);
    const orgs:Record<string,string>={};
    for(const account of accounts.slice(1)){
      const org=(await client.query('SELECT app.admin_operator($1) AS id',[account.role==='operator'?'North Parking (fictional)':'East Parking (fictional)'])).rows[0].id;
      orgs[account.role]=org;
      await client.query('SELECT app.admin_membership($1,$2,true)',[org,account.id]);
    }
    for(const lot of demoLots){
      const identity=(await client.query('SELECT app.create_facility($1,$2,$3,$4,$5,$6,$7,$8,$9) AS id',
        [orgs[lot.owner],lot.name,lot.area,'Fictional educational location; no physical parking access',Number(lot.lat),Number(lot.lng),lot.type,lot.price,lot.capacity])).rows[0].id;
      await client.query('UPDATE app.facilities SET code=$1 WHERE id=$2',[lot.id,identity]);
      await client.query('SELECT app.admin_approval($1,$2)',[identity,!!lot.approved]);
    }
    await client.query('COMMIT');
    }
    // Add the course's reproducible test accounts without replacing old fixtures
    // or resetting existing reservations. Passwords are random and stay in .env.
    for (const role of ['driver', 'operator']) {
      const email = role + '@test.local';
      if (accounts.some(account => account.email === email)) continue;
      const password = randomBytes(24).toString('base64url');
      const administrator = accounts.find(account => account.role === 'admin')!;
      await client.query('BEGIN');
      const id = (await client.query('SELECT auth.register_account($1,$2,$3) AS id',
        [email, role === 'driver' ? 'Fictional Test Driver' : 'Fictional Test Operator', await hashPassword(password)])).rows[0].id;
      if (role === 'operator') {
        const operator = accounts.find(account => account.role === 'operator')!;
        const org = (await client.query('SELECT operator_id FROM app.operator_memberships WHERE user_id=$1 LIMIT 1', [operator.id])).rows[0].operator_id;
        await client.query("SELECT set_config('parkly.user_id',$1,true)", [administrator.id]);
        await client.query('SELECT app.admin_membership($1,$2,true)', [org, id]);
      }
      const next = [...accounts, { id, email, password, role }];
      // Persist before commit so a restart can never silently lose a password.
      // A failed commit aborts setup and requires inspection, never a reset.
      await writeLocalEnv(directory, { PARKLY_FIXTURE_ACCOUNTS: JSON.stringify(next) });
      await client.query('COMMIT');
      accounts.push({ id, email, password, role });
    }
    await writeLocalEnv(directory, { PARKLY_FIXTURE_ACCOUNTS: JSON.stringify(accounts) });
    const browserAccount = await legacyJson<Record<string, string>>(directory, 'browser-account.json');
    if (browserAccount) {
      await writeLocalEnv(directory, { PARKLY_LEGACY_BROWSER_ACCOUNT: JSON.stringify(browserAccount) });
      await removeLegacySecret(directory, 'browser-account.json');
    }
    await removeLegacySecret(directory, 'fixture-accounts.json');
    console.log('Fictional test accounts ready. Private credentials: backend/.local/.env (never printed or committed).');
    return accounts;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(!process.env.MIGRATION_DATABASE_URL||!process.env.PARKLY_PG_DIRECTORY)throw Error('Set MIGRATION_DATABASE_URL and a private local fixture directory.');
  await seedFixtures(process.env.MIGRATION_DATABASE_URL,process.env.PARKLY_PG_DIRECTORY);
}
