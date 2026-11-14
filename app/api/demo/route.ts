// Compatibility endpoint retained for the website and existing mobile adapter.
import { readState, mutate } from '../../../lib/server/parkly-service';
import { usesPostgres, postgresProxy } from '../../../lib/server/postgres-proxy';
export const GET = (req: Request) => usesPostgres() ? postgresProxy(req,'/api/v1/compat/state') : readState(req);
export const POST = (req: Request) => usesPostgres() ? postgresProxy(req,'/api/v1/compat/action') : mutate(req);
