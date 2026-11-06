/* Gray Code Entertainment — service worker
   Cache-first for the page shell and images so the site opens fast
   and still loads when the connection is spotty. */
var CACHE = 'gce-v1';
var CORE = [
  '../',
  '../index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'gce-company-logo.jpg',
  'gce-hero-both-v3-poster.jpg',
  'hoodboss-photo.jpg',
  'cam-webbe-photo.jpg',
  'hoodboss-last7.jpg',
  'cam-motion-cover.jpg',
  'gce-business-card.jpg',
  'last7-tshirt-front.png',
  'last7-tshirt-back.png',
  'last7-hoodie-front.png',
  'last7-hoodie-back.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(CORE);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  // Page navigations: network first, fall back to the cached page offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put('../index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('../index.html').then(function (hit) {
          return hit || caches.match('../');
        });
      })
    );
    return;
  }

  // Everything else (images, icons, fonts, video poster): cache first,
  // then network — and stash fresh copies for next time.
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
