// 묘연의 연애사주 서비스 워커 — 앱처럼 설치하고, 인터넷이 끊겨도 저장된 사주를 볼 수 있게 한다.
// 늘 최신 화면을 먼저 받아 오고(network-first), 실패하면 저장해 둔 파일로 보여 준다. AI 상담(api/)은 저장하지 않는다.
// 파일을 추가하거나 이름을 바꾸면 PRECACHE와 VERSION을 함께 고쳐 주세요 (테스트가 js 파일 목록을 확인해요).
const VERSION = 'myoyeon-v1';
const PRECACHE = [
  './',
  'index.html',
  'css/style.css',
  'manifest.webmanifest',
  'favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'img/myo-full.webp',
  'img/coco-full.webp',
  'js/app.js',
  'js/bond.js',
  'js/breakup.js',
  'js/cardimage.js',
  'js/characters.js',
  'js/compat.js',
  'js/counsel.js',
  'js/daily.js',
  'js/diary.js',
  'js/dom.js',
  'js/extras.js',
  'js/future.js',
  'js/glossary.js',
  'js/intimacy.js',
  'js/lunar.js',
  'js/marriage.js',
  'js/persona.js',
  'js/presets.js',
  'js/reading.js',
  'js/reunion.js',
  'js/saju.js',
  'js/state.js',
  'js/suggest.js',
  'js/text.js',
  'js/tools.js',
  'js/ui.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  ev.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    }
  })());
});
