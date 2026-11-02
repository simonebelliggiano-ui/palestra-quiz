// Fa funzionare l'app anche senza rete. Non tocca mai le chiamate a GitHub.
const VERSIONE = 'pq-2026-11-02-2';
const FILE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/core.js', 'js/store.js',
  'fonts/manrope-latin-wght-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== VERSIONE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).catch(() => caches.match('index.html'))));
});
