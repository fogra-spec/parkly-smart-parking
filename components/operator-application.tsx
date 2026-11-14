'use client';
import { useRef, useState } from 'react';
import { useResource } from '../hooks/use-resource';
import { apiCall } from '../lib/api-client';
export type Application = { id: string; name: string; description: string; status: string; review_note: string; created_at: string };
export default function OperatorApplication() {
  const requests = useResource<{ applications: Application[] }>('/operator-applications');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), key = useRef({ fingerprint: '', value: '' });
  const pending = requests.data?.applications.some(a => a.status === 'pending');
  return <section className="panel"><span className="eyebrow">FOR PARKING OPERATORS</span><h2>Apply to manage your parking</h2><p className="muted">An administrator reviews each request before granting organization access. Approval here is an application access decision, not a verified partner agreement.</p>{(error || requests.error) && <p className="inline-error" role="alert">{error || requests.error}</p>}{requests.loading ? <p role="status">Loading your applications…</p> : <>
    {requests.data?.applications.map(a => <article className="admin-row" key={a.id}><div><strong>{a.name}</strong><small>{a.status} · {new Date(a.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Almaty' })}</small>{a.review_note && <p>{a.review_note}</p>}</div></article>)}
    {!pending && <form className="workspace-form" onSubmit={async e => {
      e.preventDefault(); const form = e.currentTarget, fd = new FormData(form), name = String(fd.get('name')), description = String(fd.get('description')), fingerprint = JSON.stringify({ name, description });
      if (key.current.fingerprint !== fingerprint) key.current = { fingerprint, value: crypto.randomUUID() };
      setBusy(true); setError(''); try { await apiCall('/operator-applications', 'POST', { name, description, idempotencyKey: key.current.value }); form.reset(); requests.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}><label>Organization name<input name="name" required minLength={2} maxLength={100} /></label><label>Parking facilities and proposed reservation inventory<textarea name="description" required minLength={10} maxLength={2000} rows={4} /></label><button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</button></form>}{pending && <p role="status">Your application is awaiting review. No operator permissions have been granted yet.</p>}</>}
  </section>;
}
