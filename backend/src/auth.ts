import { Database } from './db.ts';
import { hashPassword, verifyPassword, tokenHash, newToken } from './password.ts';
import { ApiError } from './errors.ts';
import { parse, signupInput, authInput } from './validation.ts';
import {z} from 'zod';

export function cookieToken(cookie = ''): string | null {
  const token = cookie.match(/(?:^|;\s*)parkly_auth=([^;]+)/)?.[1];
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
export const authCookie = (token: string, secure: boolean) =>
  `parkly_auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? 86400 : 0}${secure ? '; Secure' : ''}`;

export class Authentication {
  db: Database; dummy: Promise<string>;
  constructor(db: Database) { this.db = db; this.dummy = hashPassword(newToken()); }
  async limit(key: string, limit = 10, seconds = 900): Promise<void> {
    const { rows } = await this.db.pool.query('SELECT auth.consume_limit($1,$2,$3) AS allowed', [tokenHash(key), limit, seconds]);
    if (!rows[0].allowed) throw new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.');
  }
  async changePassword(user:string,body:unknown){
    const input=parse(z.object({currentPassword:z.string().min(12).max(128),newPassword:z.string().min(12).max(128)}).strict(),body);
    await this.limit('password-change:'+user,5,900);
    const previous=await this.db.call(user,'SELECT auth.own_password_hash() AS result') as string|null;
    if(!previous||!await verifyPassword(input.currentPassword,previous))throw new ApiError(401,'INVALID_CREDENTIALS','Current password is incorrect.');
    if(input.currentPassword===input.newPassword)throw new ApiError(400,'UNCHANGED_PASSWORD','Choose a different password.');
    return this.db.call(user,'SELECT auth.change_password($1,$2) AS result',[previous,await hashPassword(input.newPassword)]);
  }
  async signIn(body: unknown, signup: boolean, ip: string, oldToken: string | null) {
    const input = signup ? parse(signupInput, body) : parse(authInput, body);
    await this.limit('auth-email:' + input.email, 10, 900);
    await this.limit('auth-ip:' + ip, 100, 900);
    let identity: string;
    if (signup) {
      const hash = await hashPassword(input.password);
      identity = (await this.db.pool.query('SELECT auth.register_account($1,$2,$3) AS id',
        [input.email, 'name' in input && typeof input.name === 'string' ? input.name : '', hash])).rows[0].id;
    } else {
      const account = (await this.db.pool.query('SELECT * FROM auth.credentials($1)', [input.email])).rows[0];
      const valid = await verifyPassword(input.password, account?.password_hash || await this.dummy);
      if (!account || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      identity = account.user_id;
    }
    const token = newToken();
    await this.db.transaction(identity, async client => {
      if (oldToken) await client.query('SELECT auth.close_session($1)', [tokenHash(oldToken)]);
      await client.query('SELECT auth.open_session($1,$2)', [identity, tokenHash(token)]);
    });
    return { identity, token };
  }
}
