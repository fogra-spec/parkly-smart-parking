import handler from '../netlify/functions/parkly-api.mts';

// Vercel's Web-standard Node function reuses the tested PostgreSQL handler.
// Routing is explicit so rewrites do not lose the original API resource path.
export function originalApiRequest(request: Request): Request | null {
  const url = new URL(request.url);
  const path = url.searchParams.get('__parkly_path') || url.pathname;
  if (!path.startsWith('/api/v1/') && !['/api/demo', '/api/availability'].includes(path)) return null;
  if (path.includes('?') || path.includes('#') || path.includes('\\')) return null;
  url.pathname = path;
  url.searchParams.delete('__parkly_path');
  return new Request(url, request);
}

export function createVercelHandler(forward: typeof handler = handler) { return {
  async fetch(request: Request): Promise<Response> {
    const forwarded = originalApiRequest(request);
    if (!forwarded) return Response.json({ error: { code: 'NOT_FOUND', message: 'API route not found.' } },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    // No unverified client-supplied forwarded address is trusted for rate limits.
    return forward(forwarded, { ip: 'vercel-serverless' });
  },
}; }

export default createVercelHandler();
