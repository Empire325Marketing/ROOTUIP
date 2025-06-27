const CACHE_NAME = 'uip-v1';
const urlsToCache = [
  '/',
  '/css/uip-style.css',
  '/js/uip-scripts.js',
  '/brand/logo.svg',
  '/brand/logo-icon.svg'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
