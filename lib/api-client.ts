export function apiMessage(value: unknown): string {
  const error = (value as { error?: unknown } | null)?.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Unable to complete this request. Please try again.';
}
export async function apiCall<T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown, options?: { signal?: AbortSignal }): Promise<T> {
  const response = await fetch('/api/v1' + path, { method, credentials:'same-origin', cache:'no-store',
    signal: options?.signal,
    ...(body !== undefined ? { headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(apiMessage(data));
  return data as T;
}
