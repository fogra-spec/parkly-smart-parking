import { postgresProxy, usesPostgres } from '../../../../lib/server/postgres-proxy';
function forward(req: Request) {
  if(!usesPostgres())return Response.json({error:{code:'BACKEND_NOT_CONFIGURED',message:'The PostgreSQL backend is not configured.'}},{status:503,headers:{'Cache-Control':'no-store'}});
  return postgresProxy(req);
}
export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
