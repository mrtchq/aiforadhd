const CACHE_NAME = 'ai-for-adhd-cache-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  'https://subpagebucket.s3.eu-north-1.amazonaws.com/library/934/8efcf85b-cc3a-42b7-a2e5-168705e77dab.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching App Shell');
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('[Service Worker] Error during asset caching on install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Serve index.html for navigation requests (SPA) if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Put page in cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match('./index.html')
            .then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              return caches.match('./');
            });
        })
    );
    return;
  }

  // Cache-first for other static assets/images
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => { /* ignore offline background fetch failures */ });
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Serve cached icon for failed image requests of the brain logo
          if (event.request.destination === 'image' || url.pathname.includes('.png')) {
            return caches.match('https://subpagebucket.s3.eu-north-1.amazonaws.com/library/934/8efcf85b-cc3a-42b7-a2e5-168705e77dab.png');
          }
        });
    })
  );
});
