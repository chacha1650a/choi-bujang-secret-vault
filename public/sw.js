// 11단계 서비스 워커: 오프라인 안내 화면만 저장합니다. 메모·API 응답·토큰은 저장하지 않습니다.
const CACHE = 'offline-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

// 화면 이동 요청이 네트워크에서 실패할 때만 오프라인 안내를 보여 줍니다. /api 요청은 손대지 않습니다.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
