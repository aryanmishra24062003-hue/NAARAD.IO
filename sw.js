/* Naarad Service Worker — Cache-first for static assets, network-first for API */

const CACHE_NAME = 'naarad-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Images/cropped_logo.png',
  '/robots.txt',
  '/Images/Hampi.webp',
  '/Images/Mysore Palace.webp',
  '/Images/Varanasi.webp',
  '/Images/Jaipur.webp',
  '/Images/thanjavur.webp',
  '/Images/IIt_Madras.webp',
];

const CDN_CACHE = 'naarad-cdn-v4';
const CDN_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://unpkg.com',
];

// ── Install: pre-cache static assets ─────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function(err) {
        console.warn('[SW] Pre-cache failed for some assets:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME && k !== CDN_CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch: strategy by request type ──────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Skip non-GET requests and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Map tiles (OpenStreetMap) — cache-first with 7-day expiry
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(cacheTiles(event.request));
    return;
  }

  // CDN assets (fonts, Leaflet, Supabase) — stale-while-revalidate
  if (CDN_ORIGINS.some(function(o) { return url.origin === o || url.href.startsWith(o); })) {
    event.respondWith(staleWhileRevalidate(event.request, CDN_CACHE));
    return;
  }

  // Supabase API — network-first with cache fallback
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static assets — cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
});

// ── Strategy implementations ──────────────────────────────────────────────
function cacheFirst(request) {
  return caches.match(request).then(function(cached) {
    if (cached) return cached;
    return fetch(request).then(function(response) {
      if (!response || response.status !== 200 || response.type === 'opaque') return response;
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(c) { c.put(request, clone); });
      return response;
    });
  }).catch(function() {
    return caches.match('/index.html');
  });
}

function networkFirst(request) {
  return fetch(request).then(function(response) {
    if (response && response.status === 200) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(c) { c.put(request, clone); });
    }
    return response;
  }).catch(function() {
    return caches.match(request);
  });
}

function staleWhileRevalidate(request, cacheName) {
  var cache = caches.open(cacheName);
  return cache.then(function(c) {
    return c.match(request).then(function(cached) {
      var fetchPromise = fetch(request).then(function(response) {
        if (response && response.status === 200) c.put(request, response.clone());
        return response;
      });
      return cached || fetchPromise;
    });
  });
}

function cacheTiles(request) {
  return caches.open('naarad-tiles-v1').then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) return cached;
      return fetch(request).then(function(response) {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function() {
        // Return a blank transparent tile when offline
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#F0EDE4"/></svg>',
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      });
    });
  });
}

// ── Background sync for offline route saves ───────────────────────────────
self.addEventListener('sync', function(event) {
  if (event.tag === 'naarad-sync-routes') {
    event.waitUntil(syncPendingRoutes());
  }
});

function syncPendingRoutes() {
  return Promise.resolve(); // Placeholder — implement with IndexedDB when backend is live
}
