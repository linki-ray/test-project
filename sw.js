/* 工作台 Service Worker：网络优先（始终拉最新部署）+ 离线兜底；支持「发现新版本 → 一键刷新」 */
const CACHE = 'workbench-v2';
const SHELL = [
  '.', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'assets/css/style.css',
  'assets/js/config.js', 'assets/js/sync.js', 'assets/js/store.js', 'assets/js/utils.js', 'assets/js/app.js',
  'assets/js/pages/daily-plan.js', 'assets/js/pages/viral-videos.js', 'assets/js/pages/pet-ops.js',
  'assets/js/pages/inspiration.js', 'assets/js/pages/finance.js', 'assets/js/pages/checkin.js',
  'assets/js/pages/recipes.js', 'assets/js/pages/recipes-extra.js', 'assets/js/pages/reading.js',
  'assets/js/pages/daily.js', 'assets/js/pages/vv-creation.js', 'assets/js/pages/vv-library.js',
  'assets/data/daily-data.js', 'assets/js/epub.min.js', 'assets/js/jszip.min.js'
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
  // 第三方 API（金融/热榜/金十/乐享等）走网络优先，不缓存
  if (url.hostname !== location.hostname) {
    return e.respondWith(fetch(req).catch(function () { return new Response('{"offline":true}', { headers: { 'Content-Type': 'application/json' } }); }));
  }
  // 同域名：网络优先，始终拿最新部署；失败才用缓存（离线兜底）
  e.respondWith(fetch(req).then(function (resp) {
    if (resp && resp.ok) { var cp = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
    return resp;
  }).catch(function () {
    return caches.match(req).then(function (c) { return c || caches.match('index.html'); });
  }));
});

// 收到「跳过等待」指令后激活新版本（配合页面「立即刷新」）
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
