//sw.js

// キャッシュ名の定義（バージョンを変えると新しいキャッシュとして扱われる）
const CACHE_NAME = 'demo-cache-v2';

// オフライン時に表示するHTMLのURL
const OFFLINE_URL = 'offline.html';

// Firebase Storage のキャッシュ対象ファイル（URLエンコード済み）
const FIREBASE_FILE_URL = 'https://firebasestorage.googleapis.com/v0/b/my-website-2b713.firebasestorage.app/o/uploads%2F%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88.txt?alt=media&token=afddefd5-5c83-42b0-ac88-b8167d25918d';

// installイベント：初回登録や更新時に発火。キャッシュをここで作成。
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const urlsToCache = [
        '/',                // ルート
        '/index.html',      // トップページ
        '/offline.html',    // オフライン用ページ
        '/app.js',          // アプリJS
        '/style.css',       // スタイルCSS
        FIREBASE_FILE_URL   // Firebase上のテキストファイル
      ];

      // それぞれのファイルをキャッシュに追加（失敗しても継続）
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

  // 新しいServiceWorkerを即座に有効化
  self.skipWaiting();
});

// activateイベント：古いキャッシュの削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', key);
            return caches.delete(key); // 古いキャッシュを削除
          }
        })
      )
    )
  );

  // ページの制御をすぐに開始
  self.clients.claim();
});

// fetchイベント：全てのリクエストに対して発火し、キャッシュの使用可否を判断
self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);

  // Firebase Storage からのファイルはキャッシュ優先
  if (requestURL.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached; // キャッシュがあれば返す

        // なければネットワークから取得してキャッシュに保存
        return fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone()).catch(err => {
              console.warn('[ServiceWorker] Cache put failed:', err);
            });
            return networkResponse;
          });
        }).catch(() => caches.match(OFFLINE_URL)); // ネットワークも失敗したらoffline.html
      })
    );
    return;
  }

  // HTML ナビゲーションの要求（リンククリックやURL直打ち） → オフラインなら offline.html を表示
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // その他リソース（CSS, JS, 画像など）はキャッシュ優先、失敗時はリソースタイプごとの代替案を表示
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).catch(() => {
        // キャッシュにもなく、ネットワークも失敗 → 種別ごとに対応
        switch (event.request.destination) {
          case 'style':
            return caches.match('/style.css'); // CSSの代替
          case 'document':
            return caches.match(OFFLINE_URL);  // HTMLの代替
          default:
            return new Response('', { status: 404 }); // その他は404空レスポンス
        }
      });
    })
  );
});

// pushイベント：Webプッシュ通知受信時に表示
self.addEventListener('push', event => {
  const message = event.data ? event.data.text() : "通知があります";
  event.waitUntil(
    self.registration.showNotification(message)
  );
});