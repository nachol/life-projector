// Minimal service worker: makes the controller installable as an app (PWA).
// Network-first, so the LAN server is always the source of truth.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
