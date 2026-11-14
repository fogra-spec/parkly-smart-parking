import { database } from '../../../lib/server/database';
import { availabilitySql } from '../../../lib/server/booking-sql';
import { json } from '../../../lib/server/parkly-service';
import { validateBookingWindow } from '../../../lib/booking';
import { usesPostgres, postgresProxy } from '../../../lib/server/postgres-proxy';

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const id = q.get('id'), start = Number(q.get('start')), end = Number(q.get('end'));
  try {
    if (!id || id.length > 128) throw new Error();
    validateBookingWindow(start, end);
  } catch { return json({ error: 'Invalid booking time range.' }, 400); }
  if(usesPostgres()){
    const response=await postgresProxy(req,`/api/v1/facilities/${encodeURIComponent(id!)}/spaces?start=${start}&end=${end}`);
    if(!response.ok)return response;
    const result=await response.json() as {spaces:{available:boolean}[]};
    return json({available:result.spaces.filter(s=>s.available).length,spaces:result.spaces,source:'allocated_inventory',physicalOccupancy:'not_available'});
  }
  try {
    const row = await database().prepare(availabilitySql).bind(start, end, id).first<{ available: number }>();
    if (!row) return json({ error: 'Listing not found.' }, 404);
    return json({ ...row, source: 'demo', meaning: 'Allocated reservation inventory, not physical occupancy.' });
  } catch { return json({ error: 'Availability is temporarily unavailable.' }, 503); }
}
