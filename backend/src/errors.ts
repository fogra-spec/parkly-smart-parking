export class ApiError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export function publicError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const e = error as { code?: string; message?: string };
  const match = /^(400|401|403|404|409|410|429)\|([A-Z_]+)\|(.+)$/.exec(e.message || '');
  if (match) return new ApiError(Number(match[1]), match[2], match[3]);
  if (e.code === '23P01') return new ApiError(409, 'SPACE_UNAVAILABLE', 'This space overlaps a reservation, hold or maintenance block.');
  if (e.code === '23505') return new ApiError(409, 'ALREADY_EXISTS', 'This record already exists.');
  if (['23503','23514','22P02','22003'].includes(e.code || '')) return new ApiError(400, 'INVALID_INPUT', 'Invalid record or referenced resource.');
  if (e.code === '42501') return new ApiError(403, 'ACCESS_DENIED', 'This operation is not permitted.');
  if (['40001','40P01','57014'].includes(e.code || '')) return new ApiError(409, 'RETRY_REQUEST', 'A concurrent operation changed this resource. Retry with the same request key.');
  return new ApiError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.');
}
