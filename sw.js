/* Service worker de «Mi vinilo».
 * - App shell: precache versionado (?v=) + cache-first. Para publicar una versión nueva, sube CACHE_VERSION
 *   (y ejecuta `npm run build`, que actualiza el ?v= de index.html).
 * - Navegación: network-first con vuelta a la caché.
 * - Portadas (i.discogs.com): caché de ejecución aparte (COVER_CACHE), con límite; NO se borra al cambiar de versión.
 * - api.discogs.com: nunca se cachea aquí (la app guarda los datos en IndexedDB). */
const CACHE_VERSION = 'v1';
const APP_VERSION = '1.0.0';
const PREFIX = 'mi-vinilo-';
const SHELL_CACHE = `${PREFIX}shell-${CACHE_VERSION}`;
const COVER_CACHE = `${PREFIX}portadas`;
const MAX_COVERS = 1200;
const SHELL = [
  './',
  './index.html',
  `./styles.css?v=${CACHE_VERSION}`,
  `./app.js?v=${CACHE_VERSION}`,
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== SHELL_CACHE && k !== COVER_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'version' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ appVersion: APP_VERSION, cacheVersion: CACHE_VERSION });
  }
});

async function trimCovers(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_COVERS;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]); // las más antiguas primero
}

async function coverRequest(event) {
  const req = event.request;
  const cache = await caches.open(COVER_CACHE);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  // Las respuestas opacas (no-cors) tienen status 0: se guardan igualmente.
  if (res && (res.type === 'opaque' || res.ok)) {
    event.waitUntil(cache.put(req.url, res.clone()).then(() => trimCovers(cache)).catch(() => {}));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'i.discogs.com') {
      event.respondWith(coverRequest(event).catch(() => Response.error()));
    }
    return; // api.discogs.com y el resto: directo a la red
  }

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
          const copy = res.clone();
          event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy)).catch(() => {}));
        }
        return res;
      } catch (err) {
        return (await caches.match('./index.html', { ignoreSearch: true })) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const copy = res.clone();
        event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {}));
      }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
