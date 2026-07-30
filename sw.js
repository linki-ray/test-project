/* 工作台 Service Worker：缓存应用外壳，支持离线打开 + 安装到主屏幕 */
const CACHE = 'workbench-v1';
const SHELL = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'assets/css/style.css',
  'assets/js/config.js',
  'assets/js/sync.js',
  'assets/js/store.js',
  'assets/js/utils.js',
  'assets/js/app.js',
  'assets/js/pages/daily-plan.js',
  'assets/js/pages/viral-videos.js',
  'assets/js/pages/pet-ops.js',
  'assets/js/pages/inspiration.js',
  'assets/js/pages/finance.js',
  'assets/js/pages/checkin.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // 第三方 API（金融/热榜/ Supabase）走网络优先，不缓存
  if (url.hostname !== location.hostname) {
    return e.respondWith(fetch(req).catch(function () { return new Response('{"offline":true}', { headers: { 'Content-Type': 'application/json' } }); }));
  }
  // 本应用资源：缓存优先，失败回退网络
  e.respondWith(caches.match(req).then(function (cached) {
    if (cached) return cached;
    return fetch(req).then(function (resp) {
      if (resp.ok) { var cp = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
      return resp;
    }).catch(function () { return caches.match('index.html'); });
  }));
});
