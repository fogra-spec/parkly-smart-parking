'use client';
import { useState } from 'react';
import { useResource } from '../hooks/use-resource';
type Report = { bookings: number; completed: number; cancelled: number; completedGmv: number; estimatedCommission: number; estimatedOperatorAllocation: number };
const money = (n: number) => new Intl.NumberFormat('en-KZ', { maximumFractionDigits: 2 }).format(n) + ' ₸';
export default function ServerReports() {
  const [range, setRange] = useState(''), [error, setError] = useState('');
  const report = useResource<Report>('/reports' + range);
  function download() {
    if (!report.data) return;
    const lines = ['Metric,Value,Unit,Basis', ...Object.entries(report.data).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k},${v},${['bookings','completed','cancelled'].includes(k)?'count':k==='commissionRateAssumption'?'ratio':'KZT'},stored reservations; no payments collected`)];
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'parkly-reservation-report.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="panel server-reports"><div className="row"><h2>Reservation & value report</h2><div className="booking-actions"><button className="small-btn" onClick={report.reload}>Refresh report</button><button className="small-btn" disabled={!report.data} onClick={download}>Download CSV</button></div></div>
    <form className="history-search" onSubmit={e => {
      e.preventDefault(); const fd = new FormData(e.currentTarget), start = new Date(String(fd.get('start')) + 'T00:00:00+05:00').getTime(), end = new Date(String(fd.get('end')) + 'T00:00:00+05:00').getTime() + 86400000;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) { setError('Choose a valid date range.'); return; }
      setError(''); setRange('?' + new URLSearchParams({ start: String(start), end: String(end) }));
    }}><label>Created from · Astana<input name="start" type="date" required /></label><label>Created through · Astana<input name="end" type="date" required /></label><button className="outline-btn">Apply dates</button><button type="button" className="small-btn" onClick={() => { setRange(''); setError(''); }}>All dates</button></form>
    <p className="fine-print">{range ? 'Selected creation dates' : 'All dates'} · all authorized stored records. Completed reservation GMV is not Parkly revenue. Commission is an estimate at the assumed 10% rate; the operator allocation is 90% before costs. No payments, settlements or actual operating costs are recorded.</p>
    {(error || report.error) && <p className="inline-error" role="alert">{error || report.error}</p>}{report.loading ? <p role="status">Loading report…</p> : report.data && <dl className="report-values">{[
      ['Reservations', report.data.bookings], ['Completed', report.data.completed], ['Cancelled', report.data.cancelled], ['Completed reservation GMV', money(report.data.completedGmv)], ['Estimated Parkly commission', money(report.data.estimatedCommission)], ['Operator allocation before costs', money(report.data.estimatedOperatorAllocation)]
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
  </section>;
}
