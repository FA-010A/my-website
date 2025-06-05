const CACHE_NAME = 'demo-cache-v2';
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

      // 各リソースのキャッシュとログ出力
      await Promise.allSettled(
        urlsToCache.map(async url => {
          try {
            await cache.add(url);
            console.log('[ServiceWorker] Cached:', url);
          } catch (err) {
            console.warn('[ServiceWorker] Failed to cache:', url, err);
          }
        })
      );
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
            console.log('[ServiceWorker] Deleting old cache:', key);
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

  // Firebase Storage のファイル → キャッシュ優先
  if (requestURL.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        return fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone()).catch(err => {
              console.warn('[ServiceWorker] Cache put failed:', err);
            });
            return networkResponse;
          });
        }).catch(() => caches.match(OFFLINE_URL));
      })
    );
    return;
  }

  // HTML ナビゲーション → オフライン時は offline.html を返す
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // その他のリソース（CSS, JS, 画像など）
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).catch(() => {
        switch (event.request.destination) {
          case 'style': // CSS
            return caches.match('/style.css');
          case 'document': // HTML ページ
            return caches.match(OFFLINE_URL);
          default:
            return new Response('', { status: 404 });
        }
      });
    })
  );
});

self.addEventListener('push', event => {
  const message = event.data ? event.data.text() : "通知があります";
  event.waitUntil(
    self.registration.showNotification(message)
  );
});