//sw.js

// キャッシュ名の定義（バージョンを変えると新しいキャッシュとして扱われる）
const CACHE_NAME = 'cache';
const OFFLINE_URL = '/offline.html'; // オフライン時の代替ページ

// Firebase Storage のキャッシュ対象ファイル（URLエンコード済み）
const FIREBASE_FILE_URL = 'https://firebasestorage.googleapis.com/v0/b/my-website-2b713.firebasestorage.app/o/uploads%2F%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88.txt?alt=media&token=afddefd5-5c83-42b0-ac88-b8167d25918d';

// installイベント：初回登録や更新時に発火。キャッシュをここで作成。
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const urlsToCache = [
        '/',                // ルート
        '/index.html',      // トップページ
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

// stale-while-revalidate戦略の実装
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // ネットワークから最新版を取得する Promise
  const networkPromise = fetch(request).then(async networkResponse => {
    // レスポンスが正常な場合のみキャッシュを更新
    if (networkResponse && networkResponse.status === 200) {
      try {
        await cache.put(request, networkResponse.clone());
        console.log('[ServiceWorker] Cache updated:', request.url);
      } catch (err) {
        console.warn('[ServiceWorker] Cache put failed:', err);
      }
    }
    return networkResponse;
  }).catch(error => {
    console.warn('[ServiceWorker] Network fetch failed:', error);
    return null;
  });

  // キャッシュがある場合は即座に返し、バックグラウンドで更新
  if (cachedResponse) {
    // バックグラウンドで更新を実行（結果を待たない）
    networkPromise.catch(() => {}); // エラーハンドリング済み
    return cachedResponse;
  }

  // キャッシュがない場合はネットワークの結果を待つ
  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // ネットワークも失敗した場合のフォールバック
  return new Response('', { status: 404 });
}

// fetchイベント：全てのリクエストに対して発火し、キャッシュの使用可否を判断
self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);

  // Firebase Storage からのファイルはstale-while-revalidate戦略を使用
  if (requestURL.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // HTML ナビゲーションの要求（リンククリックやURL直打ち）
  if (event.request.mode === 'navigate') {
    event.respondWith(
      staleWhileRevalidate(event.request).then(response => {
        // 404やその他のエラーの場合はオフラインページを表示
        if (!response || response.status === 404) {
          return caches.match(OFFLINE_URL) || new Response('オフラインです', { status: 503 });
        }
        return response;
      })
    );
    return;
  }

  // その他リソース（CSS, JS, 画像など）
  event.respondWith(
    staleWhileRevalidate(event.request).then(response => {
      if (response && response.status === 200) {
        return response;
      }

      // キャッシュにもなく、ネットワークも失敗 → 種別ごとに対応
      return caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

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

