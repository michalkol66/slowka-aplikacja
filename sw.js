// Service Worker: pozwala używać aplikacji bez internetu (np. w metrze).
// Strona: najpierw sieć (żeby dostawać aktualizacje), a bez sieci – wersja z pamięci.
// Pliki JS/CSS/ikony: z pamięci, bo mają w nazwie hash i się nie zmieniają.
const CACHE = 'slowka-v2';

async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch('./', { cache: 'no-cache' });
  await cache.put('./', res.clone());
  const html = await res.text();
  const assets = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll([...new Set(assets)]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreVary: true })),
    );
    return;
  }

  event.respondWith(
    // ignoreVary: skrypty modułowe wysyłają nagłówek Origin, przez co odpowiedź z "Vary: Origin"
    // nie pasowałaby do tej zapisanej przy instalacji.
    caches.match(req, { ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
