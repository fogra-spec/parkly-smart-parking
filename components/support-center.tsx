'use client';
import { useState, useRef } from 'react';
import { useResource } from '../hooks/use-resource';
import { apiCall } from '../lib/api-client';

type Ticket = { id: string; subject: string; status: string; updated_at: string; reservation_id: string | null };
type Thread = { ticket: Ticket; messages: { id: string; body: string; created_at: string; author_id: string; staff: boolean }[] };
const local = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Almaty' });
export default function SupportCenter({ admin = false }: { admin?: boolean }) {
  const[offset,setOffset]=useState(0);
  const list = useResource<{ tickets: Ticket[];total:number }>('/support?limit=20&offset='+offset);
  const [selected, select] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const key = useRef({ fingerprint: '', value: '' });
  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form), subject = String(fd.get('subject')), message = String(fd.get('message'));
    const fingerprint = JSON.stringify({ subject, message });
    if (key.current.fingerprint !== fingerprint) key.current = { fingerprint, value: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const result = await apiCall<{ id: string }>('/support', 'POST', { subject, message, idempotencyKey: key.current.value });
      select(result.id); list.reload(); form.reset(); key.current.fingerprint = '';
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="panel support-center" id="support-center"><div className="row"><h2>{admin ? 'User support queue' : 'Help from Parkly'}</h2><button className="small-btn" onClick={list.reload}>Refresh cases</button></div>
    <p className="muted">Requests are stored securely in Parkly. Responses are not guaranteed within a fixed time. Never include passwords, payment details or sensitive documents.</p>
    {(error || list.error) && <p role="alert" className="inline-error">{error || list.error}</p>}
    {!admin && <details><summary>Open a support case</summary><form className="workspace-form" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}><label>Subject<input name="subject" minLength={3} maxLength={120} required /></label><label>How can we help?<textarea name="message" minLength={3} maxLength={4000} rows={4} required /></label><button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send support request'}</button></form></details>}
    <div className="case-layout"><div className="case-list" aria-label="Support cases">{list.loading ? <p role="status">Loading cases…</p> : !list.data?.tickets.length ? <p className="muted">No support cases yet.</p> : list.data.tickets.map(item => <button className={'case-button ' + (selected === item.id ? 'selected' : '')} key={item.id} onClick={() => select(item.id)}><strong>{item.subject}</strong><span>{item.status.replace('_', ' ')} · {local(item.updated_at)}</span></button>)}</div>{selected && <SupportThread key={selected} id={selected} admin={admin} onChanged={list.reload} />}</div>
    {list.data&&<div className="pagination"><button className="small-btn" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-20))}>Previous</button><span>{list.data.total} cases</span><button className="small-btn" disabled={offset+20>=list.data.total} onClick={()=>setOffset(n=>n+20)}>Next</button></div>}
  </section>;
}
function SupportThread({ id, admin, onChanged }: { id: string; admin: boolean; onChanged: () => void }) {
  const thread = useResource<Thread>('/support/' + id), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const key = useRef({ fingerprint: '', value: '' });
  return <div className="support-thread"><h3>{thread.data?.ticket.subject || 'Support conversation'}</h3>{(error || thread.error) && <p role="alert" className="inline-error">{error || thread.error}</p>}{thread.loading && <p role="status">Loading messages…</p>}
    {thread.data?.messages.map(message => <article className={'support-message ' + (message.staff ? 'staff' : '')} key={message.id}><small>{message.staff ? 'Parkly administrator' : 'Account holder'} · {local(message.created_at)}</small><p>{message.body}</p></article>)}
    {thread.data && <form className="workspace-form" onSubmit={async e => {
      e.preventDefault(); const form = e.currentTarget, fd = new FormData(form), message = String(fd.get('message')), status = admin ? String(fd.get('status')) : null;
      const fingerprint = JSON.stringify({ id, message, status }); if (key.current.fingerprint !== fingerprint) key.current = { fingerprint, value: crypto.randomUUID() };
      setBusy(true); setError(''); try { await apiCall('/support/' + id + '/messages', 'POST', { message, status, idempotencyKey: key.current.value }); form.reset(); thread.reload(); onChanged(); key.current.fingerprint = ''; } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}><label>Reply<textarea name="message" minLength={3} maxLength={4000} rows={3} required /></label>{admin && <label>Case status<select name="status" defaultValue={thread.data.ticket.status}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label>}<button className="outline-btn" disabled={busy}>{busy ? 'Saving…' : 'Send reply'}</button></form>}
  </div>;
}
