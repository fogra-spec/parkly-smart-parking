/* Only public, identity-free fallback assets are cached. No API, page HTML,
   RSC payload, reservation, auth route, map tile, or account data is cached. */
const CACHE = 'parkly-public-v4-photos';
const PUBLIC_ASSETS = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_ASSETS)));
});

// Only a device binding and delivery IDs are stored here, never booking data,
// addresses, session tokens, push endpoints or reminder capability tokens.
function pushStore(action) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open('parkly-push-v1', 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('state');
    opening.onerror = () => reject(Error('Push storage is unavailable.'));
    opening.onsuccess = () => {
      const db = opening.result, transaction = db.transaction('state', 'readwrite');
      let result; action(transaction.objectStore('state'), value => { result = value; });
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = () => { db.close(); reject(Error('Push storage failed.')); };
    };
  });
}
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
self.addEventListener('message', event => {
  if (event.data?.type === 'PARKLY_ACTIVATE_UPDATE') { self.skipWaiting(); return; }
  if (event.data?.type === 'PARKLY_BOOKING_CHANGED' && uuid(event.data.bookingId)) {
    event.waitUntil(self.registration.getNotifications({ tag: 'parkly-booking-' + event.data.bookingId }).then(items => items.forEach(n => n.close()))); return;
  }
  if (!['PARKLY_PUSH_BIND', 'PARKLY_PUSH_CLEAR'].includes(event.data?.type)) return;
  event.waitUntil(pushStore((store, done) => {
    if (event.data.type === 'PARKLY_PUSH_BIND' && uuid(event.data.deviceId)) store.put(event.data.deviceId, 'binding');
    else store.delete('binding'); done(true);
  }).then(async () => {
    if (event.data.type === 'PARKLY_PUSH_CLEAR') {
      const existing = await self.registration.getNotifications(); existing.forEach(notification => notification.close());
    }
    event.ports[0]?.postMessage({ ok: true });
  }).catch(() => event.ports[0]?.postMessage({ ok: false })));
});
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload; try { payload = event.data?.json(); } catch { return; }
    if (!uuid(payload?.id) || !uuid(payload?.deviceId) || !/^[a-f0-9]{64}$/.test(payload?.token || '')) return;
    const binding = await pushStore((store, done) => { const r = store.get('binding'); r.onsuccess = () => done(r.result); });
    if (binding !== payload.deviceId) return;
    const headers = { 'X-Parkly-Push-Device': payload.deviceId, 'X-Parkly-Push-Token': payload.token };
    // The encrypted short-lived capability works after browser login expiry;
    // it returns generic text only. Logout, changes and opt-out revoke it.
    const response = await fetch('/api/v1/push/events/' + payload.id, { headers, cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return;
    const message = await response.json(); if (!uuid(message.bookingId)) return;
    const claim = await pushStore((store, done) => {
      const r = store.get('seen:' + payload.id); r.onsuccess = () => {
        if (r.result) { done(false); return; } store.put(Date.now(), 'seen:' + payload.id); done(true);
      };
      const cursor = store.openCursor(); cursor.onsuccess = () => { const item = cursor.result;
        if (!item) return; if (String(item.key).startsWith('seen:') && item.value < Date.now() - 7 * 86400000) item.delete(); item.continue(); };
    });
    if (!claim) return;
    let shown = false;
    try {
      await self.registration.showNotification('Parkly', { body: message.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
        tag: 'parkly-booking-' + message.bookingId, renotify: false, data: { bookingId: message.bookingId } });
      shown = true;
      await fetch('/api/v1/push/events/' + payload.id + '/display', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
    } catch {
      // A failed display can be retried if the push service redelivers. Never
      // fabricate a delivered acknowledgement or substitute a page alert.
      if (!shown) await pushStore((store, done) => { store.delete('seen:' + payload.id); done(true); });
    }
  })().catch(() => {}));
});
self.addEventListener('notificationclick', event => {
  event.notification.close(); const booking = event.notification.data?.bookingId;
  if (!uuid(booking)) return;
  const url = new URL('/#/driver?booking=' + encodeURIComponent(booking), self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); return existing.focus(); } return self.clients.openWindow(url);
  }));
});
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => Promise.all(clients.map(client => client.postMessage({ type: 'PARKLY_PUSH_RECONNECT' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('parkly-public-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || request.headers.has('RSC') ||
      ['/signin-with-chatgpt', '/signout-with-chatgpt', '/callback'].includes(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match('/offline.html')) || Response.error()));
    return;
  }
  if (PUBLIC_ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
