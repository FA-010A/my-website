const CACHE_NAME = 'demo-cache-v2'; // v1 → v2 に変更して更新を明確に
const OFFLINE_URL = 'offline.html';
const FIREBASE_FILE_URL = 'https://firebasestorage.googleapis.com/v0/b/my-website-2b713.firebasestorage.app/o/uploads%2F%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88.txt?alt=media&token=afddefd5-5c83-42b0-ac88-b8167d25918d';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const urlsToCache = [
        '/',
        '/index.html',
        '/offline.html',
        '/app.js',
        '/style.css',
        FIREBASE_FILE_URL
      ];

      // すべてのファイルをキャッシュ（失敗しても続行）
      await Promise.allSettled(urlsToCache.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);

  // Firebase ファイルはキャッシュ優先で
  if (requestURL.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone()).catch(err => {
              console.warn('Cache put failed:', err);
            });
            return networkResponse;
          });
        }).catch(() => caches.match(OFFLINE_URL));
      })
    );
    return;
  }

  // HTML ナビゲーション要求（例: 直接URL入力やリンククリック時）
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // その他リソース（CSS, JS, 画像等）
  event.respondWith(
    caches.match(event.request).then(res => {
      return res || fetch(event.request).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// Push 通知処理
self.addEventListener('push', event => {
  const message = event.data ? event.data.text() : "通知があります";
  event.waitUntil(
    self.registration.showNotification(message)
  );
});