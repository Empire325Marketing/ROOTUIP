/**
 * ROOTUIP Service Worker
 * Enables offline functionality and PWA features
 */

const CACHE_NAME = 'rootuip-v1';
const DYNAMIC_CACHE = 'rootuip-dynamic-v1';
const API_CACHE = 'rootuip-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/js/app.js',
  '/js/offline.js',
  '/images/logo-192.png',
  '/images/logo-512.png',
  '/offline.html',
  '/container-tracking',
  '/dashboard',
  '/alerts'
];

// API endpoints to cache
const API_ROUTES = [
  '/api/dashboard/metrics',
  '/api/containers/recent',
  '/api/alerts/active',
  '/api/user/profile'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('Service Worker: Cache failed', err))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE && cache !== API_CACHE) {
              console.log('Service Worker: Clearing old cache');
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          // Return cached version
          return response;
        }

        // Fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Add to dynamic cache
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.destination === 'document') {
              return caches.match('/offline.html');
            }
          });
      })
  );
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone response before caching
      const responseToCache = networkResponse.clone();
      
      // Update cache in background
      caches.open(API_CACHE).then(cache => {
        cache.put(request, responseToCache);
      });
      
      return networkResponse;
    }
  } catch (error) {
    console.log('Service Worker: Network request failed, checking cache');
  }

  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Add header to indicate cached response
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-From-Cache', 'true');
    
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: headers
    });
  }

  // Return error response
  return new Response(JSON.stringify({
    error: 'Offline',
    message: 'No cached data available'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('Service Worker: Sync event', event.tag);
  
  if (event.tag === 'sync-containers') {
    event.waitUntil(syncContainerData());
  } else if (event.tag === 'sync-alerts') {
    event.waitUntil(syncAlertData());
  }
});

// Push notification handling
self.addEventListener('push', event => {
  console.log('Service Worker: Push event');
  
  let notificationData = {
    title: 'ROOTUIP Alert',
    body: 'You have a new notification',
    icon: '/images/logo-192.png',
    badge: '/images/badge-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: notificationData.vibrate,
      data: notificationData.data,
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/images/check.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/images/cross.png'
        }
      ]
    })
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification click');
  
  event.notification.close();

  if (event.action === 'view') {
    // Open the app to specific container or alert
    event.waitUntil(
      clients.openWindow('/alerts/' + event.notification.data.primaryKey)
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-containers') {
    event.waitUntil(updateContainerData());
  }
});

// Helper functions for background sync
async function syncContainerData() {
  try {
    // Get pending updates from IndexedDB
    const pendingUpdates = await getPendingUpdates('containers');
    
    if (pendingUpdates.length > 0) {
      // Send updates to server
      const response = await fetch('/api/containers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingUpdates)
      });

      if (response.ok) {
        // Clear pending updates
        await clearPendingUpdates('containers');
        
        // Notify clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_COMPLETE',
            data: 'containers'
          });
        });
      }
    }
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
  }
}

async function syncAlertData() {
  try {
    // Fetch latest alerts
    const response = await fetch('/api/alerts/latest');
    if (response.ok) {
      const alerts = await response.json();
      
      // Update cache
      const cache = await caches.open(API_CACHE);
      await cache.put('/api/alerts/active', new Response(JSON.stringify(alerts)));
      
      // Check for critical alerts
      const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
      if (criticalAlerts.length > 0) {
        // Show notification for critical alerts
        await self.registration.showNotification('Critical Alert', {
          body: `${criticalAlerts.length} critical alerts require attention`,
          icon: '/images/logo-192.png',
          badge: '/images/badge-72.png',
          tag: 'critical-alerts',
          requireInteraction: true
        });
      }
    }
  } catch (error) {
    console.error('Service Worker: Alert sync failed', error);
  }
}

async function updateContainerData() {
  try {
    // Fetch latest container updates
    const response = await fetch('/api/containers/updates');
    if (response.ok) {
      const updates = await response.json();
      
      // Update cache
      const cache = await caches.open(API_CACHE);
      await cache.put('/api/containers/recent', new Response(JSON.stringify(updates)));
      
      // Notify clients of updates
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'CONTAINER_UPDATE',
          data: updates
        });
      });
    }
  } catch (error) {
    console.error('Service Worker: Container update failed', error);
  }
}

// IndexedDB helpers (simplified)
async function getPendingUpdates(store) {
  // In production, this would interface with IndexedDB
  return [];
}

async function clearPendingUpdates(store) {
  // In production, this would clear IndexedDB records
  return true;
}

// Message handling from clients
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then(cache => cache.addAll(event.data.urls))
    );
  }
});