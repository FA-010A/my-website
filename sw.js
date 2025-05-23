// インストール
self.addEventListener('install', function (e) {
    console.info('install', e);
    console.log("インストールしました")
});

// アクティベート
self.addEventListener('activate', function (e) {
    console.info('activate', e);
    console.log("activate")
});

// フェッチ
self.addEventListener('fetch', function (e) {
    console.info('fetch', e);
    console.log("fetch")
});

self.addEventListener('push', event => {
    const message = event.data.text();// 文字列を取得
    message="test"
    event.waitUntil(
        self.registration.showNotification(message)
    );
});
self.addEventListener('DOMContentLoaded',function(e){
    console.info(e);
    self.registration.update()
    
})