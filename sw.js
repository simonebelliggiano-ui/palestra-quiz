// Fa funzionare l'app anche senza rete. Non tocca mai le chiamate a GitHub.
const VERSIONE = 'pq-2026-11-02-3';
const FILE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/core.js', 'js/store.js',
  'fonts/manrope-latin-wght-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // "reload" evita di mettere in archivio copie vecchie rimaste nella cache del browser.
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== VERSIONE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});

// La pagina si chiede prima alla rete, così gli aggiornamenti arrivano subito.
// Se la rete manca o non risponde entro 3 secondi, si usa la copia salvata.
async function paginaFresca(req) {
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), 3000);
  try {
    const r = await fetch(req, { signal: stop.signal, cache: 'no-cache' });
    if (r.ok) return r;
    throw new Error('risposta non valida');
  } catch {
    return (await caches.match('index.html')) || Response.error();
  } finally { clearTimeout(t); }
}
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') { e.respondWith(paginaFresca(e.request)); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
