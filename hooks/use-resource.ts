'use client';
import { useEffect, useState } from 'react';
import { apiMessage } from '../lib/api-client';

export function useResource<T>(path: string) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>({ key: '' });
  const key = path + ':' + version;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1' + path, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(apiMessage(data));
        return data as T;
      }).then(data => setResult({ key, data }))
      .catch(error => { if (!controller.signal.aborted) setResult({ key, error: error.message || 'Unable to load this page.' }); });
    return () => controller.abort();
  }, [path, key]);
  return { data: result.key === key ? result.data : undefined, error: result.key === key ? result.error : undefined, loading: result.key !== key, reload: () => setVersion(n => n + 1) };
}
