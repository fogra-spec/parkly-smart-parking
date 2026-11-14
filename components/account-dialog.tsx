'use client';
import { ArrowRight, X } from 'lucide-react';
import type { ParklyData } from '../lib/contracts';
import PasswordAccount from './password-account';

export default function AccountDialog({ auth, user, busy, onClose, onSelect, onLogout, onAuthenticated }: {
  auth: ParklyData['auth']; user: ParklyData['user']; busy: boolean;
  onClose: () => void; onSelect: (role: string) => void; onLogout: () => Promise<void>;
  onAuthenticated: () => Promise<void>;
}) {
  const demo = auth?.mode === 'demo';
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={e => e.stopPropagation()}>
      <button className="close" aria-label="Close account dialog" onClick={onClose}><X /></button>
      <span className="eyebrow">{demo ? 'SHARED ACCOUNTS' : 'YOUR PARKLY ACCOUNT'}</span>
      <h2 id="account-title">{demo ? 'Choose your perspective.' : 'Welcome to Parkly.'}</h2>
      {auth?.mode==='password'?<PasswordAccount user={user} onAuthenticated={onAuthenticated} onLogout={onLogout}/>:demo ? <>
        <p className="muted">Shared accounts without individual identity verification. No registration or passwords required. This mode is restricted to this computer.</p>
        {[
          ['driver', 'Driver', 'Find a space and manage bookings'],
          ['operator', 'North Parking operator', 'Manage your three demo locations'],
          ['operator-east', 'East Parking operator', 'Manage a separate partner portfolio'],
          ['admin', 'Administrator', 'Review listings, users and bookings'],
        ].map(([role, title, desc]) => <button className="role-choice" disabled={busy} key={role} onClick={() => onSelect(role)}>
          <span><strong>{title}</strong><small>{desc}</small></span><ArrowRight size={18} />
        </button>)}
        {user && <button className="text-link" disabled={busy} onClick={onLogout}>Sign out</button>}
      </> : auth?.mode === 'sites' ? <>
        <p className="muted">{user ? `Signed in as ${user.name}. Your permissions are assigned on the server.` : 'Sign in with ChatGPT to manage your own reservations. New accounts receive the driver role.'}</p>
        <a className="btn" href={user ? auth.signOutPath : auth.signInPath} target="_top">{user ? 'Sign out' : 'Sign in with ChatGPT'}<ArrowRight size={18} /></a>
      </> : <p className="muted">Sign-in is not configured for this host. You can browse listings. Reservations and management actions require a configured identity provider.</p>}
    </section>
  </div>;
}
