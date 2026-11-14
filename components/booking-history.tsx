'use client';
import { useRef, useState } from 'react';
import { useResource } from '../hooks/use-resource';
import { apiCall } from '../lib/api-client';
import type { Booking } from '../lib/contracts';
const money = (n: number) => new Intl.NumberFormat('en-KZ').format(n) + ' ₸';
const local = (n: number | string) => new Date(n).toLocaleString('en-GB', { timeZone: 'Asia/Almaty', dateStyle: 'medium', timeStyle: 'short' });
type Page = { reservations: Booking[]; total: number; serverNow: number };
export default function BookingHistory({ scope, bucket = 'all', onExtend, onChanged }: { scope: 'own' | 'managed' | 'authorized'; bucket?: string; onExtend: (id: string) => void; onChanged: () => Promise<unknown> }) {
  const [offset, setOffset] = useState(0), [q, search] = useState(''), [selected, select] = useState(''), [cancel, setCancel] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), keys = useRef(new Map<string, string>());
  const list = useResource<Page>('/reservations?' + new URLSearchParams({ scope, bucket, limit: '20', offset: String(offset), q }));
  async function action(booking: Booking, operation: string) {
    setBusy(true); setError(''); const fingerprint = booking.id + operation;
    if (!keys.current.has(fingerprint)) keys.current.set(fingerprint, crypto.randomUUID());
    try {
      await apiCall('/reservations/' + booking.id + '/' + operation, 'POST', operation === 'cancel' ? { idempotencyKey: keys.current.get(fingerprint) } : {});
      if (operation === 'cancel') navigator.serviceWorker?.controller?.postMessage({ type: 'PARKLY_BOOKING_CHANGED', bookingId: booking.id });
      setCancel(''); list.reload(); await onChanged();
    } catch (e) { setError((e as Error).message); list.reload(); } finally { setBusy(false); }
  }
  return <section className="history-section" aria-label="Reservation history"><div className="row"><h2 className="subheading">{scope === 'own' ? 'Your reservations' : 'Reservation operations'}</h2><button className="small-btn" disabled={busy} onClick={list.reload}>Refresh history</button></div>
    <form className="history-search" onSubmit={e => { e.preventDefault(); setOffset(0); search(String(new FormData(e.currentTarget).get('q'))); }}><label>Find a booking<input name="q" placeholder="Reference, facility or space" maxLength={160} /></label><button className="outline-btn">Search history</button></form>
    {(error || list.error) && <p className="inline-error" role="alert">{error || list.error}</p>}
    {list.loading ? <p role="status" className="panel">Loading reservations…</p> : !list.data?.reservations.length ? <div className="empty"><h3>No reservations in this view</h3><p>Try another tab or search. Confirmed bookings appear here after the server accepts them.</p></div> : <div className="booking-cards">{list.data.reservations.map(b => {
      const now = list.data!.serverNow, staff = scope !== 'own', active = b.status === 'confirmed';
      return <article className="panel booking-record" key={b.id}><div className="row"><span className={'status ' + b.status}>{b.status.replaceAll('_', ' ')}</span><small className="muted">{b.reference}</small></div><h3>{b.name}</h3><p>{b.floor_name} · Spot {b.space_label}</p><dl className="booking-facts"><div><dt>Arrival · Astana</dt><dd>{local(b.start)}</dd></div><div><dt>Departure · Astana</dt><dd>{local(b.end)}</dd></div><div><dt>Reservation value</dt><dd>{money(b.total)}</dd></div></dl><p className="fine-print">Stored reservation value; no payment collected. {b.session_state ? 'Session: ' + b.session_state + ', recorded by the operator.' : 'Physical occupancy is not verified.'}</p>
        <div className="booking-actions"><button className="small-btn" onClick={() => select(selected === b.id ? '' : b.id)} aria-expanded={selected === b.id}>Booking details</button>
          {active && b.end > now && <button className="small-btn" disabled={busy} onClick={() => onExtend(b.id)}>Extend Parking</button>}
          {staff && active && (b.session_state === 'active' ? <button className="small-btn" disabled={busy} onClick={() => action(b, 'check-out')}>Record check-out</button> : b.start <= now && b.end > now && <button className="small-btn" disabled={busy} onClick={() => action(b, 'check-in')}>Record check-in</button>)}
          {active && b.session_state !== 'active' && (staff || b.start > now) && <button className="small-btn" disabled={busy} onClick={() => setCancel(cancel === b.id ? '' : b.id)}>Cancel reservation</button>}
        </div>
        {cancel === b.id && <div className="cancel-review"><p>Cancel this reservation and release its allocated space? No payment or refund will be processed.</p><button className="small-btn" disabled={busy} onClick={() => setCancel('')}>Keep booking</button><button className="btn" disabled={busy} onClick={() => action(b, 'cancel')}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</button></div>}
        {selected === b.id && <BookingDetails id={b.id} own={scope==='own'} key={b.id + b.end + b.status} />}
      </article>;
    })}</div>}
    {list.data && <div className="pagination"><button className="small-btn" disabled={offset === 0 || busy} onClick={() => setOffset(n => Math.max(0, n - 20))}>Previous</button><span>{list.data.total ? `${offset + 1}–${Math.min(offset + 20, list.data.total)}` : '0'} of {list.data.total}</span><button className="small-btn" disabled={offset + 20 >= list.data.total || busy} onClick={() => setOffset(n => n + 20)}>Next</button></div>}
  </section>;
}
function BookingDetails({ id, own }: { id: string; own:boolean }) {
  const detail = useResource<{ reservation: Booking; history: { from_status: string | null; to_status: string; created_at: string }[]; extensions: { old_end: string; new_end: string; added_kzt: number; created_at: string }[] }>('/reservations/' + id);
  return <div className="booking-detail"><h4>Booking confirmation & history</h4>{detail.error && <p role="alert" className="inline-error">{detail.error}</p>}{detail.loading && <p role="status">Loading booking history…</p>}{detail.data && <><p>{/^Fictional location/i.test(detail.data.reservation.address||'')?'Location area shown on the facility map':detail.data.reservation.address}</p>{own&&<a className="text-link" href={'/#/driver?booking=' + id}>Open session view</a>}<ol className="event-timeline">{detail.data.history.map((event, i) => <li key={i}><strong>{event.to_status.replaceAll('_', ' ')}</strong><small>{local(event.created_at)}</small></li>)}</ol>{detail.data.extensions.map(event => <p key={event.created_at}>Extended to {local(event.new_end)} · added {money(event.added_kzt)}</p>)}</>}</div>;
}
