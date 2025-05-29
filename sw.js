const CACHE_NAME = 'demo-cache-v1';
const OFFLINE_URL = 'offline.html';
const FIREBASE_FILE_URL = 'https://firebasestorage.googleapis.com/v0/b/my-website-2b713.firebasestorage.app/o/uploads%2F%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88.txt?alt=media&token=afddefd5-5c83-42b0-ac88-b8167d25918d';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([
        '/',
        '/index.html',
        '/offline.html',
        '/app.js',
        '/style.css',
        FIREBASE_FILE_URL
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);

  // Firebase Storageのファイルだったらキャッシュ優先
  if (requestURL.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          return caches.match('/offline.html');
        });
      })
    );
    return;
  }

  // 通常のHTMLナビゲーション
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  } else {
    // その他のリソース
    event.respondWith(
      caches.match(event.request).then(res => res || fetch(event.request))
    );
  }
});

self.addEventListener('push', event => {
  const message = event.data ? event.data.text() : "test";
  event.waitUntil(
    self.registration.showNotification(message)
  );
});
