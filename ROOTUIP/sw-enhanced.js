// UIP Enterprise Service Worker - Performance Optimized v3
const CACHE_NAME = 'uip-enterprise-v3-performance';
const STATIC_CACHE = 'uip-static-v3';
const DYNAMIC_CACHE = 'uip-dynamic-v3';

// Critical resources for immediate caching
const CRITICAL_RESOURCES = [
  '/',
  '/index.html',
  '/brand/logo-horizontal.svg',
  '/brand/favicon.svg',
  '/js/enhanced-lazy-loading.min.js'
];

// Assets to cache on demand
const CACHEABLE_EXTENSIONS = ['.css', '.js', '.svg', '.webp', '.png', '.jpg', '.jpeg', '.woff', '.woff2'];

// Install event - cache critical resources immediately
self.addEventListener('install', event => {
  console.log('SW: Installing v3 with performance optimizations');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('SW: Caching critical resources');
        return cache.addAll(CRITICAL_RESOURCES);
      })
      .then(() => {
        console.log('SW: Critical resources cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('SW: Failed to cache critical resources:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('SW: Activating v3');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!['uip-static-v3', 'uip-dynamic-v3'].includes(cacheName)) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Cache cleanup complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extensions and external domains
  if (!url.origin.includes(self.location.origin)) {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Strategy 1: Critical resources - Cache First
    if (isCriticalResource(pathname)) {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // Strategy 2: Static assets - Stale While Revalidate
    if (isStaticAsset(pathname)) {
      return await staleWhileRevalidate(request, STATIC_CACHE);
    }
    
    // Strategy 3: HTML pages - Network First with fallback
    if (isHTMLPage(pathname)) {
      return await networkFirstWithFallback(request, DYNAMIC_CACHE);
    }
    
    // Strategy 4: Everything else - Network First
    return await networkFirst(request, DYNAMIC_CACHE);
    
  } catch (error) {
    console.error('SW: Fetch failed:', error);
    return new Response('Offline - Please check your connection', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Cache First - For critical resources that rarely change
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  if (networkResponse.status === 200) {
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

// Stale While Revalidate - For static assets
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Fetch in background to update cache
  const fetchPromise = fetch(request).then(response => {
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => {}); // Ignore network errors for background updates
  
  // Return cached version immediately if available
  return cachedResponse || fetchPromise;
}

// Network First with Fallback - For HTML pages
async function networkFirstWithFallback(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return fallback for HTML requests
    if (request.destination === 'document') {
      return caches.match('/') || new Response('Offline', { status: 503 });
    }
    
    throw error;
  }
}

// Network First - For API calls and dynamic content
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200 && isStaticAsset(request.url)) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    return cachedResponse || Promise.reject(error);
  }
}

// Helper functions
function isCriticalResource(pathname) {
  return CRITICAL_RESOURCES.some(resource => pathname.includes(resource));
}

function isStaticAsset(pathname) {
  return CACHEABLE_EXTENSIONS.some(ext => pathname.includes(ext));
}

function isHTMLPage(pathname) {
  return pathname === '/' || pathname.includes('.html') || !pathname.includes('.');
}

// Performance monitoring
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_STATS') {
    caches.keys().then(cacheNames => {
      Promise.all(
        cacheNames.map(async cacheName => {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          return { name: cacheName, size: keys.length };
        })
      ).then(stats => {
        event.ports[0].postMessage({
          type: 'CACHE_STATS_RESPONSE',
          stats: stats
        });
      });
    });
  }
});

console.log('SW: UIP Enterprise Service Worker v3 loaded successfully');