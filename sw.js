/* Gray Code Entertainment — service worker (site root, so its scope
  covers the whole site). Cache-first for the page shell and images
  so the site opens fast and still loads when the connection is spotty. */
var CACHE = 'gce-v3';
var CORE = [
  './',
  '/artists',
  '/booking',
  '/coming-soon',
  '/models',
  '/music',
  '/services',
  '/store',
  'assets/manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png',
  'assets/gce-company-logo.jpg',
  'assets/gce-hero-both-v3-poster.jpg',
  'assets/hoodboss-photo.jpg',
  'assets/cam-webbe-photo.jpg',
  'assets/hoodboss-last7.jpg',
  'assets/cam-motion-cover.jpg',
  'assets/gce-business-card.jpg',
  'assets/last7-tshirt-front.png',
  'assets/last7-tshirt-back.png',
  'assets/last7-hoodie-front.png',
  'assets/last7-hoodie-back.png',
  'gce-hero-both-v3.mp4'
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
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }
  // Everything else: cache first, refresh the cache in the background.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { });
      return hit || network;
    })
  );
});

// Bypass the service worker for Stripe checkout links.
self.addEventListener('fetch', function (event) {
  if (event.request.url.indexOf('buy.stripe.com') !== -1) {
    event.respondWith(fetch(event.request));
  }
});
