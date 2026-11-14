'use client';
import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function PwaStatus() {
  const [offline, setOffline] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [registrationError, setRegistrationError] = useState(false);
  useEffect(() => {
    const status = () => setOffline(!navigator.onLine);
    const offer = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const installed = () => setInstall(null);
    status();
    window.addEventListener('online', status);
    window.addEventListener('offline', status);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => setRegistrationError(true));
    }
    return () => {
      window.removeEventListener('online', status); window.removeEventListener('offline', status);
      window.removeEventListener('beforeinstallprompt', offer); window.removeEventListener('appinstalled', installed);
    };
  }, []);
  return <>
    {offline && <div className="connection-banner" role="alert">You are offline. Availability and account changes require an internet connection. A booking is confirmed only after the server accepts it.</div>}
    {registrationError && <div className="connection-banner" role="status">Offline support could not start. The online website is still available.</div>}
    {install && <button className="pwa-install small-btn" onClick={async () => {
      const event = install; setInstall(null); await event.prompt(); await event.userChoice;
    }}>Install Parkly</button>}
  </>;
}
