/**
 * StudyHub Service Worker (PWA Offline Cache)
 * Enables installability (Add to Home Screen) and full offline operation.
 */

const CACHE_NAME = 'studyhub-cache-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/data/userSchedule.js',
  './js/utils/helpers.js',
  './js/components/navbar.js',
  './js/components/modal.js',
  './js/components/toast.js',
  './js/components/search.js',
  './js/components/trashModal.js',
  './js/components/attachments.js',
  './backup_default.json',
  './js/modules/dashboard.js',
  './js/modules/subjects.js',
  './js/modules/schedule.js',
  './js/modules/tasks.js',
  './js/modules/notes.js',
  './js/modules/mindmap.js',
  './js/modules/imageNotes.js',
  './js/modules/exams.js',
  './js/modules/grades.js',
  './js/modules/progress.js',
  './js/modules/timer.js',
  './js/modules/notification.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// Install Event: Pre-cache local app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-First for local assets, Network-First or Stale-While-Revalidate for CDN assets
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Handle HTML navigation: try cache, fallback to network or offline index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Handle all other assets (CSS, JS, Fonts, Images, CDNs)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch and update cache in background (Stale-While-Revalidate)
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {/* Offline, ignore */});
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache
      return fetch(req).then((networkResponse) => {
        // Cache valid responses including opaque responses from CDNs
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
        }
        return networkResponse;
      }).catch((err) => {
        console.warn('[SW] Fetch failed for:', req.url, err);
        // Fallback for images
        if (req.destination === 'image') {
          return caches.match('./icons/icon-192.png');
        }
      });
    })
  );
});
