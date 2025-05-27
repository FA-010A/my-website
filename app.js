if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}
self.addEventListener('install', () => console.log('install Ver1'));
self.addEventListener('activate', () => console.log('activate Ver1'));
