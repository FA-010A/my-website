navigator.serviceWorker.register('sw.js');
self.addEventListener('install', () => console.log('install Ver1'));
self.addEventListener('activate', () => console.log('activate Ver1'));

