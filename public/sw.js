const CACHE = 'brujula-shell-v10';
const SHELL = ['/', '/style.css', '/app.js', '/personalization.js', '/bulletin.js', '/audio-player.js', '/clip-player.js', '/news-music.js', '/narration.js', '/icons.js', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(r => r || new Response('Sin conexión', { status: 503 }))));
});
