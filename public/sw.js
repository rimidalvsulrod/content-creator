const V = 'prompter-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then((res) => { const c = res.clone(); caches.open(V).then((x) => x.put('/', c)); return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }
  e.respondWith(
    caches.match(r).then((hit) => hit || fetch(r).then((res) => {
      if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)).catch(() => {}); }
      return res;
    }))
  );
});
