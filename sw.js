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



