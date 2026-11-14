import pg from 'pg';
import type { PoolClient } from 'pg';

export class Database {
  pool: pg.Pool;
  private closing = false;
  constructor(connectionString: string, maxConnections = 12) {
    const url = new URL(connectionString);
    const local = ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
    if (!local && url.searchParams.get('sslmode') !== 'verify-full') {
      throw Error('Remote PostgreSQL requires sslmode=verify-full and a trusted certificate.');
    }
    this.pool = new pg.Pool({ connectionString, max: maxConnections, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 });
    this.pool.on('error', () => { if (!this.closing) console.error('PostgreSQL pool connection error.'); });
  }
  async assertRestrictedRole(): Promise<void> {
    const { rows: [role] } = await this.pool.query(`SELECT r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('app','auth') AND pg_has_role(r.oid,c.relowner,'MEMBER')) AS owns_tables
      FROM pg_roles r WHERE r.rolname=current_user`);
    if (!role || role.rolsuper || role.rolbypassrls || role.rolcreaterole || role.rolcreatedb || role.owns_tables) {
      throw Error('API must use a restricted NOBYPASSRLS role without ownership, owner membership, CREATEROLE or CREATEDB.');
    }
  }
  async transaction<T>(user: string | null, action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL TIME ZONE 'UTC'");
      await client.query("SET LOCAL statement_timeout = '8s'");
      await client.query("SELECT set_config('parkly.user_id',$1,true)", [user || '']);
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async userForSession(hash: string): Promise<string | null> {
    const { rows } = await this.pool.query('SELECT auth.session_user($1) AS id', [hash]);
    return rows[0]?.id || null;
  }
  async call(user: string | null, sql: string, parameters: unknown[] = []): Promise<unknown> {
    return this.transaction(user, async client => (await client.query(sql, parameters)).rows[0]?.result);
  }
  async close(): Promise<void> { this.closing = true; await this.pool.end(); }
}
