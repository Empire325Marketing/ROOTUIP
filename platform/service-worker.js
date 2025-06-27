// ROOTUIP Service Worker v1.0
const CACHE_NAME = 'rootuip-v1';
const DYNAMIC_CACHE = 'rootuip-dynamic-v1';

// Core assets to cache for offline functionality
const STATIC_ASSETS = [
  '/platform/customer/dashboard.html',
  '/platform/customer/user-management.html',
  '/platform/customer/data-interfaces.html',
  '/platform/customer/support.html',
  '/platform/customer/onboarding.html',
  '/platform/enterprise/workflow-manager.html',
  '/platform/integration-dashboard.html',
  '/platform/manifest.json',
  '/assets/css/platform.css',
  '/assets/js/platform.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// API endpoints that should work offline (return cached data)
const OFFLINE_API_FALLBACKS = {
  '/api/metrics': {
    activeShipments: 127,
    onTimeDelivery: 94.2,
    ddRiskScore: 2.8,
    costSavings: 142000
  },
  '/api/shipments': {
    shipments: [],
    total: 0
  },
  '/api/notifications': {
    notifications: [],
    unreadCount: 0
  }
};

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip chrome-extension and non-http(s) requests
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Network-first strategy for HTML pages
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(handleHtmlRequest(request));
    return;
  }
  
  // Cache-first strategy for assets
  event.respondWith(handleAssetRequest(request));
});

// Handle API requests with offline fallback
async function handleApiRequest(request) {
  try {
    const response = await fetch(request);
    
    // Clone and cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] API request failed, checking cache');
    
    // Try to get from cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline fallback data
    const pathname = new URL(request.url).pathname;
    const fallbackData = OFFLINE_API_FALLBACKS[pathname];
    
    if (fallbackData) {
      return new Response(JSON.stringify(fallbackData), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // Return error response
    return new Response(JSON.stringify({ error: 'Offline' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503
    });
  }
}

// Handle HTML requests with network-first strategy
async function handleHtmlRequest(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Network request failed, serving from cache');
    
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page
    return caches.match('/platform/offline.html');
  }
}

// Handle asset requests with cache-first strategy
async function handleAssetRequest(request) {
  const cached = await caches.match(request);
  
  if (cached) {
    // Update cache in background
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(request, response);
        });
      }
    });
    
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Asset request failed:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-shipments') {
    event.waitUntil(syncShipments());
  } else if (event.tag === 'sync-documents') {
    event.waitUntil(syncDocuments());
  }
});

// Sync offline data when connection restored
async function syncShipments() {
  try {
    const db = await openIndexedDB();
    const pendingShipments = await getPendingShipments(db);
    
    for (const shipment of pendingShipments) {
      await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipment)
      });
      
      await markShipmentSynced(db, shipment.id);
    }
    
    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'sync-complete',
        data: 'shipments'
      });
    });
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', event => {
  console.log('[ServiceWorker] Push received');
  
  const options = {
    title: 'ROOTUIP Platform',
    body: event.data ? event.data.text() : 'New notification',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/assets/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/icons/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('[ServiceWorker] Notification click:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/platform/notifications.html')
    );
  }
});

// IndexedDB helpers
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rootuip-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('shipments')) {
        db.createObjectStore('shipments', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
    };
  });
}

// Get pending shipments from IndexedDB
function getPendingShipments(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['shipments'], 'readonly');
    const store = transaction.objectStore('shipments');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const shipments = request.result.filter(s => !s.synced);
      resolve(shipments);
    };
  });
}

// Mark shipment as synced
function markShipmentSynced(db, shipmentId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['shipments'], 'readwrite');
    const store = transaction.objectStore('shipments');
    const request = store.get(shipmentId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const shipment = request.result;
      shipment.synced = true;
      
      const updateRequest = store.put(shipment);
      updateRequest.onerror = () => reject(updateRequest.error);
      updateRequest.onsuccess = () => resolve();
    };
  });
}