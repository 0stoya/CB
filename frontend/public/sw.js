// Pusty Service Worker - wymagany do aktywacji instalacji PWA
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Nie cache'ujemy zapytań (dla czatu realtime to niepotrzebne)
});