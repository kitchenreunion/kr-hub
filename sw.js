// KR Hub – Service Worker: App-Hülle offline verfügbar, Daten immer live, Push-Benachrichtigungen.
const CACHE = 'krhub-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Firebase-Bibliothek (versioniert, ändert sich nie) → einmal laden, danach aus dem Speicher
  if (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })));
    return;
  }
  if (u.origin !== location.origin) return; // API-Aufrufe nie cachen
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});

// ---------- Push-Benachrichtigungen (Firebase Cloud Messaging, Daten-Nachrichten)
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = { data: { title: 'KR Hub', body: e.data ? e.data.text() : '' } }; }
  const d = p.data || p.notification || p;
  e.waitUntil(self.registration.showNotification(d.title || 'KR Hub', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png',
    tag: d.tag || undefined, renotify: !!d.tag, data: { link: d.link || './' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.link) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) { c.postMessage({ nav: url }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
