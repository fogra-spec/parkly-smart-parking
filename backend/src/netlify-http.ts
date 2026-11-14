import { validateBookingWindow } from '../../lib/booking.ts';

type Handler = (request: Request, clientAddress: string) => Promise<Response>;

// Compatibility routes retain their existing contracts, forwarding all writes
// and session cookies to the same authoritative PostgreSQL handler.
export function netlifyHttp(handle: Handler) {
  return async (request: Request, context: { ip?: string }): Promise<Response> => {
    const url = new URL(request.url);
    const legacyAvailability = url.pathname === '/api/availability';
    if (url.pathname === '/api/demo') {
      if (!['GET', 'POST'].includes(request.method)) return new Response(null, { status: 405 });
      url.pathname = request.method === 'GET' ? '/api/v1/compat/state' : '/api/v1/compat/action';
    } else if (legacyAvailability && request.method === 'GET') {
      const id = url.searchParams.get('id'), start = Number(url.searchParams.get('start')), end = Number(url.searchParams.get('end'));
      try {
        if (!id || id.length > 128) throw Error('Invalid facility');
        validateBookingWindow(start, end);
      } catch { return Response.json({ error: 'Invalid booking time range.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }
      url.pathname = `/api/v1/facilities/${encodeURIComponent(id!)}/spaces`;
      url.search = new URLSearchParams({ start: String(start), end: String(end) }).toString();
    } else if (!url.pathname.startsWith('/api/v1/')) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'API route not found.' } }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    const response = await handle(new Request(url, request), context.ip || 'unknown');
    if (!legacyAvailability || !response.ok) return response;
    const result = await response.json() as { spaces: { available: boolean }[] };
    return Response.json({ available: result.spaces.filter(space => space.available).length, spaces: result.spaces,
      source: 'allocated_inventory', physicalOccupancy: 'not_available' }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
  };
}
