'use client';
import { useState } from 'react';
import { apiCall } from '../lib/api-client';
import { clearPushBinding } from '../lib/browser-push';
export default function PasswordSettings({ onChanged }: { onChanged: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <details className="panel"><summary><strong>Password & account security</strong></summary><p className="muted">Changing your password signs out all sessions and revokes their push device bindings. Sign in again with your new password.</p><form className="workspace-form" onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget, fd = new FormData(form), newPassword = String(fd.get('newPassword')); setError('');
    if (newPassword !== fd.get('confirm')) { setError('New passwords do not match.'); return; }
    setBusy(true); try { await apiCall('/auth/password', 'POST', { currentPassword: fd.get('currentPassword'), newPassword }); form.reset(); await clearPushBinding().catch(() => {}); await onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" minLength={12} maxLength={128} required /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><label>Confirm new password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>{error && <p role="alert" className="inline-error">{error}</p>}<button className="outline-btn" disabled={busy}>{busy ? 'Updating…' : 'Change password & sign out'}</button></form></details>;
}
